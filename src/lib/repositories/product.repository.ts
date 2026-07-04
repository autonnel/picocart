import type {
  Prisma,
  Product,
  ProductImage,
  ProductStatus,
  ProductVariant,
  VariantOption,
  VariantPrice,
} from '@prisma/client';
import { prisma } from '@/lib/db';
import { withTenantData, withTenantWhere } from './tenant-helpers';

export interface VariantOptionInput {
  name: string;
  value: string;
  position?: number;
}

export interface VariantPriceInput {
  currencyCode: string;
  price: number | string;
  compareAtPrice?: number | string | null;
}

export interface VariantInput {
  sku?: string | null;
  title: string;
  position?: number;
  inventoryQuantity?: number;
  weight?: number | null;
  weightUnit?: string | null;
  barcode?: string | null;
  requiresShipping?: boolean;
  options?: VariantOptionInput[];
  prices?: VariantPriceInput[];
  imagePosition?: number;
}

export interface ProductImageInput {
  src: string;
  alt?: string | null;
  position?: number;
}

export interface CreateProductInput {
  handle: string;
  title: string;
  description?: string | null;
  status?: ProductStatus;
  trackInventory?: boolean;
  vendor?: string | null;
  productType?: string | null;
  tags?: string[];
  variants?: VariantInput[];
  images?: ProductImageInput[];
}

export interface UpdateProductInput {
  handle?: string;
  title?: string;
  description?: string | null;
  status?: ProductStatus;
  trackInventory?: boolean;
  vendor?: string | null;
  productType?: string | null;
  tags?: string[];
}

export interface ListProductsOptions {
  status?: ProductStatus;
  sinceId?: string;
  limit?: number;
}

export type ProductWithRelations = Product & {
  variants: (ProductVariant & {
    prices: VariantPrice[];
    options: VariantOption[];
  })[];
  images: ProductImage[];
};

export interface IProductRepository {
  create(input: CreateProductInput): Promise<ProductWithRelations>;
  getById(id: string): Promise<ProductWithRelations | null>;
  getByHandle(handle: string): Promise<ProductWithRelations | null>;
  list(options?: ListProductsOptions): Promise<ProductWithRelations[]>;
  update(id: string, input: UpdateProductInput): Promise<Product>;
  delete(id: string): Promise<void>;
  count(options?: { status?: ProductStatus }): Promise<number>;
}

const productInclude = {
  variants: {
    include: {
      prices: true,
      options: { orderBy: { position: 'asc' } },
    },
    orderBy: { position: 'asc' },
  },
  images: { orderBy: { position: 'asc' } },
} satisfies Prisma.ProductInclude;

export class PrismaProductRepository implements IProductRepository {
  async create(input: CreateProductInput): Promise<ProductWithRelations> {
    return prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: withTenantData({
          handle: input.handle,
          title: input.title,
          description: input.description ?? null,
          status: input.status ?? 'ACTIVE',
          trackInventory: input.trackInventory ?? false,
          vendor: input.vendor ?? null,
          productType: input.productType ?? null,
          tags: input.tags ?? [],
        }),
      });

      const createdImages: ProductImage[] = [];
      const images = input.images ?? [];
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const created = await tx.productImage.create({
          data: {
            productId: product.id,
            src: img.src,
            alt: img.alt ?? null,
            position: img.position ?? i,
          },
        });
        createdImages.push(created);
      }

      const variants = input.variants ?? [];
      for (let vi = 0; vi < variants.length; vi++) {
        const v = variants[vi];
        const imageId =
          v.imagePosition !== undefined && createdImages[v.imagePosition]
            ? createdImages[v.imagePosition].id
            : null;
        const variant = await tx.productVariant.create({
          data: {
            productId: product.id,
            sku: v.sku ?? null,
            title: v.title,
            position: v.position ?? vi,
            inventoryQuantity: v.inventoryQuantity ?? 0,
            weight: v.weight ?? null,
            weightUnit: v.weightUnit ?? null,
            barcode: v.barcode ?? null,
            requiresShipping: v.requiresShipping ?? true,
            imageId,
          },
        });

        const opts = v.options ?? [];
        for (let oi = 0; oi < opts.length; oi++) {
          const o = opts[oi];
          await tx.variantOption.create({
            data: {
              variantId: variant.id,
              name: o.name,
              value: o.value,
              position: o.position ?? oi,
            },
          });
        }

        for (const p of v.prices ?? []) {
          await tx.variantPrice.create({
            data: {
              variantId: variant.id,
              currencyCode: p.currencyCode,
              price: p.price as Prisma.Decimal | number | string,
              compareAtPrice:
                p.compareAtPrice === undefined || p.compareAtPrice === null
                  ? null
                  : (p.compareAtPrice as Prisma.Decimal | number | string),
            },
          });
        }
      }

      const reloaded = await tx.product.findFirst({
        where: { id: product.id },
        include: productInclude,
      });
      if (!reloaded) {
        throw new Error('Product disappeared mid-transaction');
      }
      return reloaded as ProductWithRelations;
    });
  }

  async getById(id: string): Promise<ProductWithRelations | null> {
    const result = await prisma.product.findFirst({
      where: withTenantWhere({ id }),
      include: productInclude,
    });
    return result as ProductWithRelations | null;
  }

  async getByHandle(handle: string): Promise<ProductWithRelations | null> {
    const result = await prisma.product.findFirst({
      where: withTenantWhere({ handle }),
      include: productInclude,
    });
    return result as ProductWithRelations | null;
  }

  async list(options: ListProductsOptions = {}): Promise<ProductWithRelations[]> {
    const where: Prisma.ProductWhereInput = withTenantWhere({});
    if (options.status) where.status = options.status;
    if (options.sinceId) where.id = { gt: options.sinceId };

    const limit = Math.min(Math.max(options.limit ?? 50, 1), 250);
    const result = await prisma.product.findMany({
      where,
      include: productInclude,
      orderBy: { id: 'asc' },
      take: limit,
    });
    return result as ProductWithRelations[];
  }

  async update(id: string, input: UpdateProductInput): Promise<Product> {
    const data: Prisma.ProductUpdateInput = {};
    if (input.handle !== undefined) data.handle = input.handle;
    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description;
    if (input.status !== undefined) data.status = input.status;
    if (input.trackInventory !== undefined) data.trackInventory = input.trackInventory;
    if (input.vendor !== undefined) data.vendor = input.vendor;
    if (input.productType !== undefined) data.productType = input.productType;
    if (input.tags !== undefined) data.tags = input.tags;
    return prisma.product.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await prisma.product.delete({ where: { id } });
  }

  async count(options: { status?: ProductStatus } = {}): Promise<number> {
    const where: Prisma.ProductWhereInput = withTenantWhere({});
    if (options.status) where.status = options.status;
    return prisma.product.count({ where });
  }
}

let productRepositoryInstance: IProductRepository | null = null;

export function getProductRepository(): IProductRepository {
  if (!productRepositoryInstance) {
    productRepositoryInstance = new PrismaProductRepository();
  }
  return productRepositoryInstance;
}

export function setProductRepository(repository: IProductRepository): void {
  productRepositoryInstance = repository;
}
