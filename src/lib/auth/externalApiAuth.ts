// External API authentication (used by Shopify-compat REST endpoints).

import type { APIContext } from 'astro';
import { validateApiToken, createUnauthorizedResponse } from './apiAuth';

export interface ExternalAuthResult {
  authenticated: true;
  userId?: string;
  writeAccess?: boolean;
}

export async function authenticateExternalApi(
  context: APIContext,
): Promise<ExternalAuthResult | Response> {
  const authHeader =
    context.request.headers.get('Authorization') ??
    context.request.headers.get('X-Shopify-Access-Token');
  const result = await validateApiToken(authHeader);

  if (!result.valid) {
    return createUnauthorizedResponse(result.error || 'Invalid token');
  }

  return { authenticated: true, userId: result.userId, writeAccess: result.writeAccess };
}

export function requireWriteAccess(auth: ExternalAuthResult): Response | null {
  if (!auth.writeAccess) {
    return new Response(
      JSON.stringify({
        error: {
          message: 'Write access is not enabled for this API key.',
          type: 'permission_error',
          code: 'write_access_denied',
        },
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    );
  }
  return null;
}
