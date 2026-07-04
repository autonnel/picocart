import { getOrderRepository } from '@/lib/repositories/order.repository';
import { decodeGid } from '../gid';
import { projectFulfillments } from '../projectors';
import type { GraphqlVariables } from '../router';

export async function resolveOrderFulfillments(vars: GraphqlVariables): Promise<Record<string, unknown>> {
  const id = decodeGid((vars.id as string) ?? '');
  const repo = getOrderRepository();
  const order = id ? await repo.getById(id) : null;
  if (!order) return { order: null };
  return { order: { fulfillments: projectFulfillments(order) } };
}
