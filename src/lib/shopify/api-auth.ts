// Shopify-compat API auth helper.
// Validates X-Shopify-Access-Token (Authorization: Bearer also accepted),
// asserts write access on mutations, and converts every failure into a
// Shopify-shaped error response.

import type { APIContext } from 'astro';
import { validateApiToken } from '@/lib/auth/apiAuth';
import { ApiError, toErrorResponse } from './api-error';
import { createLogger } from '@/lib/logger';

const logger = createLogger('Shopify:Auth');

export interface ShopifyAuthResult {
  userId: string;
  writeAccess: boolean;
}

function readToken(request: Request): string | null {
  const shopify = request.headers.get('X-Shopify-Access-Token');
  if (shopify && shopify.trim().length > 0) return shopify.trim();
  const auth = request.headers.get('Authorization');
  if (auth && auth.trim().length > 0) return auth.trim();
  return null;
}

export async function authenticateShopify(
  context: APIContext,
  options: { requireWrite?: boolean } = {},
): Promise<ShopifyAuthResult> {
  const token = readToken(context.request);
  if (!token) {
    throw ApiError.unauthorized();
  }
  const result = await validateApiToken(token);
  if (!result.valid || !result.userId) {
    throw ApiError.unauthorized();
  }
  if (options.requireWrite && !result.writeAccess) {
    throw ApiError.forbidden();
  }
  return { userId: result.userId, writeAccess: !!result.writeAccess };
}

type Handler = (
  context: APIContext,
  auth: ShopifyAuthResult,
) => Response | Promise<Response>;

export function withShopifyAuth(
  handler: Handler,
  options: { requireWrite?: boolean } = {},
) {
  return async (context: APIContext): Promise<Response> => {
    try {
      const auth = await authenticateShopify(context, options);
      return await handler(context, auth);
    } catch (error) {
      if (error instanceof ApiError) {
        return toErrorResponse(error);
      }
      logger.error('Unhandled Shopify API error', { error });
      return toErrorResponse(ApiError.internal());
    }
  };
}
