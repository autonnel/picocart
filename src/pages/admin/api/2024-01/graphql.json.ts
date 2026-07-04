import type { APIRoute } from 'astro';
import { withShopifyAuth } from '@/lib/shopify/api-auth';
import { readJsonBody } from '@/lib/shopify/api-utils';
import { executeGraphql, type GraphqlRequestBody } from '@/lib/shopify/graphql/handler';

export const POST: APIRoute = withShopifyAuth(async (context, auth) => {
  const body = await readJsonBody(context.request);
  const result = await executeGraphql((body ?? {}) as GraphqlRequestBody, {
    writeAccess: auth.writeAccess,
  });
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { 'Content-Type': 'application/json' },
  });
});
