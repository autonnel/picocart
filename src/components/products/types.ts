export type ProductStatus = 'ACTIVE' | 'DRAFT' | 'ARCHIVED';

export interface VariantOptionDraft {
  id?: string;
  name: string;
  value: string;
  position?: number;
}

export interface VariantPriceDraft {
  id?: string;
  currencyCode: string;
  price: string;
  compareAtPrice?: string;
}

export interface VariantDraft {
  clientId: string;
  id?: string;
  sku: string;
  title: string;
  position: number;
  inventoryQuantity: number;
  options: VariantOptionDraft[];
  prices: VariantPriceDraft[];
}

export interface ImageDraft {
  clientId: string;
  id?: string;
  src: string;
  alt?: string | null;
  position: number;
}

export interface ProductDraft {
  id?: string;
  title: string;
  handle: string;
  description: string;
  status: ProductStatus;
  trackInventory: boolean;
  vendor: string;
  productType: string;
  tags: string[];
  variants: VariantDraft[];
  images: ImageDraft[];
}

export function newClientId(): string {
  return `tmp_${Math.random().toString(36).slice(2, 11)}`;
}

export function emptyDraft(): ProductDraft {
  return {
    title: '',
    handle: '',
    description: '',
    status: 'DRAFT',
    trackInventory: false,
    vendor: '',
    productType: '',
    tags: [],
    variants: [
      {
        clientId: newClientId(),
        sku: '',
        title: 'Default Title',
        position: 0,
        inventoryQuantity: 0,
        options: [],
        prices: [],
      },
    ],
    images: [],
  };
}

export function fromServer(input: any): ProductDraft {
  return {
    id: input.id,
    title: input.title ?? '',
    handle: input.handle ?? '',
    description: input.description ?? '',
    status: input.status ?? 'DRAFT',
    trackInventory: !!input.trackInventory,
    vendor: input.vendor ?? '',
    productType: input.productType ?? '',
    tags: input.tags ?? [],
    variants: (input.variants ?? []).map((v: any, i: number) => ({
      clientId: newClientId(),
      id: v.id,
      sku: v.sku ?? '',
      title: v.title ?? '',
      position: v.position ?? i,
      inventoryQuantity: v.inventoryQuantity ?? 0,
      options: (v.options ?? []).map((o: any) => ({
        id: o.id,
        name: o.name,
        value: o.value,
        position: o.position,
      })),
      prices: (v.prices ?? []).map((p: any) => ({
        id: p.id,
        currencyCode: p.currencyCode,
        price: String(p.price ?? ''),
        compareAtPrice: p.compareAtPrice != null ? String(p.compareAtPrice) : '',
      })),
    })),
    images: (input.images ?? []).map((img: any, i: number) => ({
      clientId: newClientId(),
      id: img.id,
      src: img.src,
      alt: img.alt,
      position: img.position ?? i,
    })),
  };
}

export function toServerPayload(draft: ProductDraft) {
  return {
    title: draft.title,
    handle: draft.handle || undefined,
    description: draft.description || null,
    status: draft.status,
    trackInventory: draft.trackInventory,
    vendor: draft.vendor || null,
    productType: draft.productType || null,
    tags: draft.tags,
    variants: draft.variants.map((v, i) => ({
      id: v.id,
      sku: v.sku || null,
      title: v.title,
      position: v.position ?? i,
      inventoryQuantity: v.inventoryQuantity,
      options: v.options.map((o, oi) => ({
        name: o.name,
        value: o.value,
        position: o.position ?? oi,
      })),
      prices: v.prices
        .filter((p) => p.currencyCode && p.price !== '')
        .map((p) => ({
          currencyCode: p.currencyCode,
          price: p.price,
          compareAtPrice: p.compareAtPrice ? p.compareAtPrice : null,
        })),
    })),
    images: draft.images.map((img, i) => ({
      id: img.id,
      src: img.src,
      alt: img.alt ?? null,
      position: img.position ?? i,
    })),
  };
}
