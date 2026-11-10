import { describe, expect, it } from 'vitest';
import { fromServer, newClientId, toServerPatch } from '@/components/products/types';

const server = () => ({
  id: 'p1',
  title: 'Comb',
  handle: 'comb',
  status: 'ACTIVE',
  tags: [],
  images: [{ id: 'i1', src: 'https://x/1.png', position: 0 }],
  variants: [1, 2, 3].map((n) => ({
    id: `v${n}`,
    sku: `S${n}`,
    title: `V${n}`,
    position: n - 1,
    inventoryQuantity: 0,
    imageId: n === 1 ? 'i1' : null,
    options: [],
    prices: [{ currencyCode: 'USD', price: '10.00', isManual: true }],
  })),
});

describe('toServerPatch', () => {
  it('is empty when nothing changed', () => {
    expect(toServerPatch(fromServer(server()), fromServer(server()))).toEqual({});
  });

  it('sends only the added variant', () => {
    const draft = fromServer(server());
    draft.variants.push({
      clientId: newClientId(), sku: 'S4', title: 'V4', position: 3, inventoryQuantity: 0, options: [], prices: [],
    });
    const patch = toServerPatch(draft, fromServer(server()));
    expect(Object.keys(patch)).toEqual(['variantChanges']);
    expect(patch.variantChanges?.upsert.map((v) => v.sku)).toEqual(['S4']);
    expect(patch.variantChanges?.remove).toEqual([]);
  });

  it('sends only the edited variant and the removed id', () => {
    const draft = fromServer(server());
    draft.variants[1].title = 'Renamed';
    draft.variants.splice(2, 1);
    const patch = toServerPatch(draft, fromServer(server()));
    expect(patch.variantChanges?.upsert.map((v) => v.id)).toEqual(['v2']);
    expect(patch.variantChanges?.remove).toEqual(['v3']);
  });

  it('sends a changed scalar field alone', () => {
    const draft = fromServer(server());
    draft.title = 'New';
    expect(toServerPatch(draft, fromServer(server()))).toEqual({ title: 'New' });
  });
});
