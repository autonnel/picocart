import type { APIRoute } from 'astro';
import { withAuth, jsonResponse, jsonError } from '@/lib/api-helpers';
import { FEATURES } from '@/lib/permissions';
import { getCustomerRepository } from '@/lib/repositories/customer.repository';
import { createLogger } from '@/lib/logger';

const logger = createLogger('Api:CustomerRecompute');

export const POST: APIRoute = withAuth(FEATURES.CUSTOMERS, async ({ params }) => {
  const id = params.id;
  if (!id) return jsonError('Missing id', 400);
  try {
    const repo = getCustomerRepository();
    const customer = await repo.recomputeStats(id);
    return jsonResponse({ customer });
  } catch (error) {
    logger.error('Recompute customer stats failed', { error, customerId: id });
    return jsonError('Failed to recompute stats', 500);
  }
});
