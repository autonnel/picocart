import { getProductRepository } from '@/lib/repositories/product.repository';
import { getVariantRepository } from '@/lib/repositories/variant.repository';
import { decodeGid, encodeGid } from '../gid';
import { projectProduct, projectVariant } from '../projectors';
import { resolveCurrency } from './products';
import type { GraphqlVariables } from '../router';

export async function resolveProductVariants(vars: GraphqlVariables): Promise<Record<string, unknown>> {
  const id = decodeGid((vars.id as string) ?? '');
  const currency = await resolveCurrency(vars);
  const repo = getProductRepository();
  const product = id ? await repo.getById(id) : null;
  if (!product) return { product: null };
  const sortedVariants = [...product.variants].sort((a, b) => a.position - b.position);
  const sortedImages = [...product.images].sort((a, b) => a.position - b.position);
  const variantNodes = sortedVariants.map((v) =>
    projectVariant(v, product.trackInventory, sortedImages, currency),
  );
  return {
    product: {
      variants: { edges: variantNodes.map((node) => ({ node })), nodes: variantNodes },
    },
  };
}

export async function resolveVariant(vars: GraphqlVariables): Promise<Record<string, unknown>> {
  const variantId = decodeGid((vars.id as string) ?? '');
  const currency = await resolveCurrency(vars);
  const variantRepo = getVariantRepository();
  const variant = variantId ? await variantRepo.getById(variantId) : null;
  if (!variant) return { productVariant: null };
  const productRepo = getProductRepository();
  const product = await productRepo.getById(variant.productId);
  if (!product) return { productVariant: null };
  return {
    productVariant: {
      id: encodeGid('ProductVariant', variant.id),
      product: projectProduct(product, currency),
    },
  };
}

export async function resolveVariantInventory(vars: GraphqlVariables): Promise<Record<string, unknown>> {
  const variantId = decodeGid((vars.id as string) ?? '');
  const variantRepo = getVariantRepository();
  const variant = variantId ? await variantRepo.getById(variantId) : null;
  if (!variant) return { productVariant: null };
  return {
    productVariant: {
      id: encodeGid('ProductVariant', variant.id),
      inventoryQuantity: variant.inventoryQuantity,
    },
  };
}
