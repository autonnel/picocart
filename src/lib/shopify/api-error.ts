// Shopify-shaped API errors. Maps thrown ApiError into JSON with the
// shape Shopify clients expect (`errors` is either a string or
// `{ field: string[] }`).

export type ShopifyErrorBody =
  | { errors: string }
  | { errors: Record<string, string[]> };

export class ApiError extends Error {
  readonly status: number;
  readonly body: ShopifyErrorBody;

  constructor(status: number, body: ShopifyErrorBody, message?: string) {
    super(message ?? (typeof body.errors === 'string' ? body.errors : 'API error'));
    this.status = status;
    this.body = body;
    this.name = 'ApiError';
  }

  static notFound(resource = 'Not Found'): ApiError {
    return new ApiError(404, { errors: resource });
  }

  static unauthorized(message = '[API] Invalid API key or access token (unrecognized login or wrong password)'): ApiError {
    return new ApiError(401, { errors: message });
  }

  static forbidden(message = 'This action requires write access.'): ApiError {
    return new ApiError(403, { errors: message });
  }

  static validation(fields: Record<string, string[]>): ApiError {
    return new ApiError(422, { errors: fields });
  }

  static badRequest(message: string): ApiError {
    return new ApiError(400, { errors: message });
  }

  static internal(message = 'Internal Server Error'): ApiError {
    return new ApiError(500, { errors: message });
  }
}

export function toErrorResponse(err: unknown): Response {
  if (err instanceof ApiError) {
    return new Response(JSON.stringify(err.body), {
      status: err.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(
    JSON.stringify({ errors: 'Internal Server Error' }),
    { status: 500, headers: { 'Content-Type': 'application/json' } },
  );
}

export function zodIssuesToShopifyErrors(
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path.length > 0 ? issue.path.map((p) => String(p)).join('.') : 'base';
    const arr = out[key] ?? [];
    arr.push(issue.message);
    out[key] = arr;
  }
  return out;
}
