import type { Prisma } from '@prisma/client';
import { getCurrencyConfig } from '@/lib/dashboard/currencies';
import { convertPrice } from '@/lib/pricing/auto-price';
import { withTenantWhere } from '@/lib/repositories/tenant-helpers';

const WRITE_CHUNK = 1000;

export interface AutoPriceScope {
  variantIds?: string[];
  currencies?: string[];
}

export async function syncAutoPrices(
  tx: Prisma.TransactionClient,
  scope: AutoPriceScope,
): Promise<number> {
  const config = await getCurrencyConfig();
  const targets = Object.entries(config.rates).filter(
    ([code]) => !scope.currencies || scope.currencies.includes(code),
  );
  if (targets.length === 0) return 0;

  const variants = await tx.productVariant.findMany({
    where: {
      product: withTenantWhere({}),
      ...(scope.variantIds ? { id: { in: scope.variantIds } } : {}),
    },
    select: { id: true, prices: true },
  });

  const missing: Prisma.VariantPriceCreateManyInput[] = [];
  const updates = new Map<string, { price: string; compareAtPrice: string | null; ids: string[] }>();
  for (const variant of variants) {
    const base = variant.prices.find((p) => p.currencyCode === config.default);
    if (!base) continue;
    for (const [code, rate] of targets) {
      const existing = variant.prices.find((p) => p.currencyCode === code);
      if (existing?.isManual) continue;
      const price = convertPrice(base.price.toString(), rate, code);
      const compareAtPrice =
        base.compareAtPrice === null ? null : convertPrice(base.compareAtPrice.toString(), rate, code);
      if (!existing) {
        missing.push({ variantId: variant.id, currencyCode: code, price, compareAtPrice, isManual: false });
        continue;
      }
      // Many variants share a base price, so rows with identical results are written in one statement.
      const key = `${code}|${price}|${compareAtPrice}`;
      const group = updates.get(key) ?? { price, compareAtPrice, ids: [] };
      group.ids.push(existing.id);
      updates.set(key, group);
    }
  }

  for (let i = 0; i < missing.length; i += WRITE_CHUNK) {
    await tx.variantPrice.createMany({ data: missing.slice(i, i + WRITE_CHUNK), skipDuplicates: true });
  }
  let written = missing.length;
  for (const group of updates.values()) {
    for (let i = 0; i < group.ids.length; i += WRITE_CHUNK) {
      await tx.variantPrice.updateMany({
        where: { id: { in: group.ids.slice(i, i + WRITE_CHUNK) } },
        data: { price: group.price, compareAtPrice: group.compareAtPrice, isManual: false },
      });
    }
    written += group.ids.length;
  }
  return written;
}
