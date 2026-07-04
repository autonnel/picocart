import type { APIRoute } from 'astro';
import { withAuth, jsonResponse } from '@/lib/api-helpers';
import { FEATURES } from '@/lib/permissions';
import { prisma } from '@/lib/db';
import { withTenantWhere } from '@/lib/repositories/tenant-helpers';

export const GET: APIRoute = withAuth(FEATURES.CUSTOMERS, async ({ request }) => {
  const url = new URL(request.url);
  const sp = url.searchParams;
  const limitRaw = parseInt(sp.get('limit') || '50', 10);
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 50, 1), 250);
  const sinceId = sp.get('sinceId') || undefined;
  const q = (sp.get('q') || '').trim();

  const where = withTenantWhere<Record<string, unknown>>({});
  if (sinceId) where.id = { gt: sinceId };
  if (q) {
    where.OR = [
      { email: { contains: q, mode: 'insensitive' } },
      { firstName: { contains: q, mode: 'insensitive' } },
      { lastName: { contains: q, mode: 'insensitive' } },
    ];
  }
  const customers = await prisma.customer.findMany({
    where: where as any,
    orderBy: { id: 'asc' },
    take: limit,
  });
  return jsonResponse({ customers });
});
