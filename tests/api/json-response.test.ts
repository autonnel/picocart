import { describe, expect, it } from 'vitest';
import { jsonResponse } from '@/lib/api-helpers';

describe('jsonResponse', () => {
  it('strips tenantId at every nesting level', async () => {
    const res = jsonResponse({
      product: {
        id: 'p1',
        tenantId: 'default',
        variants: [{ id: 'v1', tenantId: 'default' }],
      },
      customers: [{ id: 'c1', tenantId: 'default' }],
    });
    const body = (await res.json()) as any;
    expect(body.product.id).toBe('p1');
    expect(body.product.tenantId).toBeUndefined();
    expect(body.product.variants[0].tenantId).toBeUndefined();
    expect(body.customers[0].tenantId).toBeUndefined();
  });

  it('preserves dates, nulls, and status', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const res = jsonResponse({ order: { createdAt, note: null } }, 201);
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.order.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(body.order.note).toBeNull();
  });
});
