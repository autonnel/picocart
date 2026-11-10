import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { installTestPrisma } from '../setup/global';
import { resetDb } from '../setup/db';
import { runWithTenant } from '@/lib/tenant/context';
import { fromServer, toServerPayload } from '@/components/products/types';

vi.mock('@/lib/api-helpers', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-helpers')>('@/lib/api-helpers');
  return {
    ...actual,
    withAuth: (_feature: string, handler: any) => async (context: any) =>
      handler(context, { user: { id: 'u-test' }, auth: {} }),
  };
});

let prisma: PrismaClient | null = null;

beforeAll(async () => {
  prisma = await installTestPrisma();
});

beforeEach(async () => {
  if (!prisma) return;
  await resetDb(prisma);
  await prisma.tenant.deleteMany();
  await prisma.tenant.create({ data: { id: 'tA' } });
});

afterAll(async () => {
  if (prisma) await prisma.$disconnect();
});

async function call(method: 'POST' | 'PUT', body: unknown, id?: string) {
  const mod = id
    ? await import('@/pages/api/products/[id]')
    : await import('@/pages/api/products/index');
  const request = new Request(`http://test/api/products${id ? `/${id}` : ''}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const handler = (mod as any)[method];
  const res: Response = await runWithTenant({ id: 'tA' }, () =>
    handler({ request, params: id ? { id } : {}, url: new URL(request.url) }),
  );
  return { status: res.status, body: (await res.json()) as any };
}

const img = (n: number) => ({ src: `https://cdn.test/${n}.jpg`, alt: null });

describe('variant images', () => {
  it('assigns a distinct image to each variant on create', async () => {
    if (!prisma) return;
    const { status, body } = await call('POST', {
      title: 'Shirt',
      images: [img(1), img(2)],
      variants: [
        { title: 'Red', options: [{ name: 'Color', value: 'Red' }], imagePosition: 1 },
        { title: 'Blue', options: [{ name: 'Color', value: 'Blue' }], imagePosition: 0 },
        { title: 'Green', options: [{ name: 'Color', value: 'Green' }] },
      ],
    });
    expect(status).toBe(201);
    const srcOf = (id: string | null) => body.product.images.find((i: any) => i.id === id)?.src ?? null;
    const byTitle = Object.fromEntries(body.product.variants.map((v: any) => [v.title, srcOf(v.imageId)]));
    expect(byTitle).toEqual({ Red: 'https://cdn.test/2.jpg', Blue: 'https://cdn.test/1.jpg', Green: null });
  });

  it('round-trips through the form draft, including newly added images and clearing', async () => {
    if (!prisma) return;
    const created = await call('POST', {
      title: 'Mug',
      images: [img(1)],
      variants: [
        { title: 'S', options: [{ name: 'Size', value: 'S' }], imagePosition: 0 },
        { title: 'L', options: [{ name: 'Size', value: 'L' }], imagePosition: 0 },
      ],
    });
    const id = created.body.product.id as string;

    const draft = fromServer(created.body.product);
    expect(draft.variants.every((v) => v.imageClientId === draft.images[0].clientId)).toBe(true);

    draft.images = [{ clientId: 'new', src: 'https://cdn.test/9.jpg', position: 0 }, { ...draft.images[0], position: 1 }];
    draft.variants[0].imageClientId = 'new';
    draft.variants[1].imageClientId = null;

    const updated = await call('PUT', toServerPayload(draft), id);
    expect(updated.status).toBe(200);
    const rows = await prisma.productVariant.findMany({ where: { productId: id }, include: { image: true }, orderBy: { position: 'asc' } });
    expect(rows.map((r) => [r.title, r.image?.src ?? null])).toEqual([
      ['S', 'https://cdn.test/9.jpg'],
      ['L', null],
    ]);
  });

  it('keeps the variant image when an update omits the image fields, and drops it when the image is deleted', async () => {
    if (!prisma) return;
    const created = await call('POST', {
      title: 'Cap',
      images: [img(1), img(2)],
      variants: [{ title: 'One', options: [{ name: 'Size', value: 'One' }], imagePosition: 1 }],
    });
    const product = created.body.product;
    const variant = product.variants[0];

    await call('PUT', { variants: [{ id: variant.id, title: 'One', options: [{ name: 'Size', value: 'One' }] }] }, product.id);
    let row = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id }, include: { image: true } });
    expect(row.image?.src).toBe('https://cdn.test/2.jpg');

    await call('PUT', { images: [{ id: product.images[0].id, src: product.images[0].src }] }, product.id);
    row = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id }, include: { image: true } });
    expect(row.imageId).toBeNull();
  });

  it('ignores an imageId that belongs to another product', async () => {
    if (!prisma) return;
    const other = await call('POST', { title: 'Other', images: [img(5)] });
    const created = await call('POST', { title: 'Hat', variants: [{ title: 'Default Title' }] });
    const v = created.body.product.variants[0];
    await call('PUT', { variants: [{ id: v.id, title: v.title, imageId: other.body.product.images[0].id }] }, created.body.product.id);
    const row = await prisma.productVariant.findUniqueOrThrow({ where: { id: v.id } });
    expect(row.imageId).toBeNull();
  });
});
