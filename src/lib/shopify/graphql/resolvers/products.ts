import { getProductRepository } from '@/lib/repositories/product.repository';
import { getDefaultCurrencyCode } from '@/lib/shopify/api-utils';
import { decodeGid, encodeGid } from '../gid';
import { currencyForCountry } from '../country';
import { projectProduct } from '../projectors';
import type { GraphqlVariables } from '../router';

interface ProductsArgs {
  first?: number;
  pageSize?: number;
  cursor?: string | null;
  after?: string | null;
  query?: string | null;
  country?: string | null;
  sortKey?: string | null;
  reverse?: boolean | null;
}

function resolveLimit(vars: GraphqlVariables): number {
  const first = typeof vars.first === 'number' ? vars.first : undefined;
  const pageSize = typeof vars.pageSize === 'number' ? vars.pageSize : undefined;
  const raw = first ?? pageSize ?? 50;
  return Math.min(Math.max(raw, 1), 250);
}

export async function resolveCurrency(vars: GraphqlVariables): Promise<string> {
  if (typeof vars.country === 'string' && vars.country.length > 0) {
    return currencyForCountry(vars.country);
  }
  return getDefaultCurrencyCode();
}

function matchesQuery(text: string, query: string | null | undefined): boolean {
  if (!query) return true;
  const needle = query.replace(/title:\*?|\*/gi, '').trim().toLowerCase();
  if (!needle) return true;
  return text.toLowerCase().includes(needle);
}

export async function resolveProducts(vars: GraphqlVariables): Promise<Record<string, unknown>> {
  const args = vars as ProductsArgs;
  const limit = resolveLimit(vars);
  const currency = await resolveCurrency(vars);
  const cursorRaw = (args.cursor ?? args.after ?? null) as string | null;
  const sinceId = cursorRaw ? decodeGid(cursorRaw) : undefined;

  const repo = getProductRepository();
  // Over-fetch by one to compute hasNextPage for the cursor-style client.
  const list = await repo.list({ sinceId, limit: limit + 1 });
  const hasNextPage = list.length > limit;
  const page = hasNextPage ? list.slice(0, limit) : list;

  const filtered =
    typeof args.query === 'string'
      ? page.filter((p) => matchesQuery(p.title, args.query))
      : page;

  const nodes = filtered.map((p) => projectProduct(p, currency));
  const endCursor = page.length > 0 ? encodeGid('Product', page[page.length - 1].id) : null;

  return {
    products: {
      edges: nodes.map((node) => ({ node, cursor: endCursor })),
      nodes,
      pageInfo: { hasNextPage, endCursor },
    },
  };
}

export async function resolveProduct(vars: GraphqlVariables): Promise<Record<string, unknown>> {
  const id = decodeGid((vars.id as string) ?? '');
  const currency = await resolveCurrency(vars);
  const repo = getProductRepository();
  const product = id ? await repo.getById(id) : null;
  return { product: product ? projectProduct(product, currency) : null };
}

export { resolveLimit };
