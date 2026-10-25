import { resolveProducts, resolveProduct } from './resolvers/products';
import { resolveProductVariants, resolveVariant, resolveVariantInventory } from './resolvers/variants';
import {
  resolveOrder,
  resolveOrderCreate,
  resolveDraftOrderCreate,
  resolveDraftOrderComplete,
} from './resolvers/orders';
import { resolveOrderFulfillments } from './resolvers/fulfillments';
import { resolveRefundCreate } from './resolvers/refunds';
import { resolveCurrencyRates } from './resolvers/currency-rates';

export type GraphqlVariables = Record<string, unknown>;

export interface OperationDef {
  resolve: (vars: GraphqlVariables) => Promise<Record<string, unknown>>;
  requiresWrite: boolean;
}

// Routing is by GraphQL operation name. Mutations require write access.
const OPERATIONS: Record<string, OperationDef> = {
  Products: { resolve: resolveProducts, requiresWrite: false },
  SearchProducts: { resolve: resolveProducts, requiresWrite: false },
  Product: { resolve: resolveProduct, requiresWrite: false },
  ProductVariants: { resolve: resolveProductVariants, requiresWrite: false },
  Variant: { resolve: resolveVariant, requiresWrite: false },
  VariantInventory: { resolve: resolveVariantInventory, requiresWrite: false },
  Order: { resolve: resolveOrder, requiresWrite: false },
  OrderFulfillments: { resolve: resolveOrderFulfillments, requiresWrite: false },
  OrderCreate: { resolve: resolveOrderCreate, requiresWrite: true },
  DraftOrderCreate: { resolve: resolveDraftOrderCreate, requiresWrite: true },
  DraftOrderComplete: { resolve: resolveDraftOrderComplete, requiresWrite: true },
  CurrencyRates: { resolve: resolveCurrencyRates, requiresWrite: false },
  RefundCreate: { resolve: resolveRefundCreate, requiresWrite: true },
};

const OPERATION_NAME = /\b(?:query|mutation)\s+([A-Za-z_][A-Za-z0-9_]*)/;

export function parseOperationName(queryText: string): string | null {
  const match = OPERATION_NAME.exec(queryText);
  return match ? match[1] : null;
}

export function lookupOperation(name: string | null): OperationDef | null {
  if (!name) return null;
  return OPERATIONS[name] ?? null;
}
