import { formatPriceInput } from '@/lib/pricing/auto-price';

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
  isManual: boolean;
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
  imageClientId?: string | null;
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
  const images: ImageDraft[] = (input.images ?? []).map((img: any, i: number) => ({
    clientId: newClientId(),
    id: img.id,
    src: img.src,
    alt: img.alt,
    position: img.position ?? i,
  }));
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
        price: formatPriceInput(p.price, p.currencyCode ?? ''),
        compareAtPrice: formatPriceInput(p.compareAtPrice, p.currencyCode ?? ''),
        isManual: p.isManual !== false,
      })),
      imageClientId: images.find((img) => img.id && img.id === v.imageId)?.clientId ?? null,
    })),
    images,
  };
}

function variantImageRef(v: VariantDraft, images: ImageDraft[]) {
  const index = v.imageClientId ? images.findIndex((img) => img.clientId === v.imageClientId) : -1;
  return index >= 0 ? { imagePosition: index } : { imageId: null };
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
          isManual: p.isManual,
        })),
      ...variantImageRef(v, draft.images),
    })),
    images: draft.images.map((img, i) => ({
      id: img.id,
      src: img.src,
      alt: img.alt ?? null,
      position: img.position ?? i,
    })),
  };
}

type ServerPayload = ReturnType<typeof toServerPayload>;

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function toServerPatch(draft: ProductDraft, baseline: ProductDraft): Partial<ServerPayload> & {
  variantChanges?: { upsert: ServerPayload['variants']; remove: string[] };
} {
  const next = toServerPayload(draft);
  const prev = toServerPayload(baseline);
  const patch: Record<string, unknown> = {};
  for (const key of ['title', 'handle', 'description', 'status', 'trackInventory', 'vendor', 'productType', 'tags'] as const) {
    if (!sameValue(next[key], prev[key])) patch[key] = next[key];
  }
  if (!sameValue(next.images, prev.images)) patch.images = next.images;

  const prevById = new Map(prev.variants.filter((v) => v.id).map((v) => [v.id as string, v]));
  const upsert = next.variants.filter((v) => !v.id || !sameValue(v, prevById.get(v.id)));
  const keptIds = new Set(next.variants.filter((v) => v.id).map((v) => v.id as string));
  const remove = [...prevById.keys()].filter((id) => !keptIds.has(id));
  if (upsert.length > 0 || remove.length > 0) patch.variantChanges = { upsert, remove };
  return patch;
}
