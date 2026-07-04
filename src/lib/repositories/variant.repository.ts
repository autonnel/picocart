import type { Prisma, ProductVariant, VariantOption, VariantPrice } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withTenantWhere } from './tenant-helpers';

export type VariantWithRelations = ProductVariant & {
  prices: VariantPrice[];
  options: VariantOption[];
};

export interface IVariantRepository {
  getById(id: string): Promise<VariantWithRelations | null>;
  listByProduct(productId: string): Promise<VariantWithRelations[]>;
  decrementInventory(variantId: string, quantity: number): Promise<ProductVariant>;
  incrementInventory(variantId: string, quantity: number): Promise<ProductVariant>;
}

const variantInclude = {
  prices: true,
  options: { orderBy: { position: 'asc' } },
} satisfies Prisma.ProductVariantInclude;

export class InsufficientInventoryError extends Error {
  constructor(variantId: string, requested: number, available: number) {
    super(
      `Insufficient inventory for variant ${variantId}: requested ${requested}, available ${available}`,
    );
    this.name = 'InsufficientInventoryError';
  }
}

export class PrismaVariantRepository implements IVariantRepository {
  async getById(id: string): Promise<VariantWithRelations | null> {
    const result = await prisma.productVariant.findFirst({
      where: { id, product: withTenantWhere({}) },
      include: variantInclude,
    });
    return result as VariantWithRelations | null;
  }

  async listByProduct(productId: string): Promise<VariantWithRelations[]> {
    const result = await prisma.productVariant.findMany({
      where: { productId, product: withTenantWhere({}) },
      include: variantInclude,
      orderBy: { position: 'asc' },
    });
    return result as VariantWithRelations[];
  }

  async decrementInventory(variantId: string, quantity: number): Promise<ProductVariant> {
    if (quantity <= 0) {
      throw new Error('decrementInventory requires a positive quantity');
    }
    return prisma.$transaction(async (tx) => {
      const variant = await tx.productVariant.findFirst({
        where: { id: variantId },
        include: { product: { select: { trackInventory: true, tenantId: true } } },
      });
      if (!variant) {
        throw new Error(`Variant ${variantId} not found`);
      }
      if (!variant.product.trackInventory) {
        return variant;
      }
      if (variant.inventoryQuantity < quantity) {
        throw new InsufficientInventoryError(
          variantId,
          quantity,
          variant.inventoryQuantity,
        );
      }
      return tx.productVariant.update({
        where: { id: variantId },
        data: { inventoryQuantity: { decrement: quantity } },
      });
    });
  }

  async incrementInventory(variantId: string, quantity: number): Promise<ProductVariant> {
    if (quantity <= 0) {
      throw new Error('incrementInventory requires a positive quantity');
    }
    const variant = await prisma.productVariant.findFirst({
      where: { id: variantId },
      include: { product: { select: { trackInventory: true } } },
    });
    if (!variant) {
      throw new Error(`Variant ${variantId} not found`);
    }
    if (!variant.product.trackInventory) {
      return variant;
    }
    return prisma.productVariant.update({
      where: { id: variantId },
      data: { inventoryQuantity: { increment: quantity } },
    });
  }
}

let variantRepositoryInstance: IVariantRepository | null = null;

export function getVariantRepository(): IVariantRepository {
  if (!variantRepositoryInstance) {
    variantRepositoryInstance = new PrismaVariantRepository();
  }
  return variantRepositoryInstance;
}

export function setVariantRepository(repository: IVariantRepository): void {
  variantRepositoryInstance = repository;
}
