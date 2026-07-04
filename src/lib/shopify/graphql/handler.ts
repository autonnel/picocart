import { lookupOperation, parseOperationName, type GraphqlVariables } from './router';
import { createLogger } from '@/lib/logger';

const logger = createLogger('Shopify:Graphql');

export interface GraphqlRequestBody {
  query?: unknown;
  variables?: unknown;
}

export interface GraphqlResult {
  status: number;
  body: { data?: unknown; errors?: Array<{ message: string }> };
}

function graphqlError(message: string, status = 200): GraphqlResult {
  return { status, body: { errors: [{ message }] } };
}

// Executes one GraphQL operation. Auth is enforced by the caller; `writeAccess`
// gates mutations. Resolver errors surface as top-level `errors`; per-operation
// business failures surface as `userErrors` inside `data` (HTTP 200).
export async function executeGraphql(
  body: GraphqlRequestBody,
  ctx: { writeAccess: boolean },
): Promise<GraphqlResult> {
  if (typeof body.query !== 'string' || body.query.trim().length === 0) {
    return graphqlError('A query string is required', 400);
  }
  const variables: GraphqlVariables =
    body.variables && typeof body.variables === 'object'
      ? (body.variables as GraphqlVariables)
      : {};

  const name = parseOperationName(body.query);
  const operation = lookupOperation(name);
  if (!operation) {
    return graphqlError(`Unsupported operation${name ? `: ${name}` : ''}`);
  }
  if (operation.requiresWrite && !ctx.writeAccess) {
    return graphqlError('This operation requires write access', 403);
  }

  try {
    const data = await operation.resolve(variables);
    return { status: 200, body: { data } };
  } catch (err) {
    logger.error('GraphQL resolver failed', { error: err, operation: name });
    return graphqlError(err instanceof Error ? err.message : 'Internal error');
  }
}
