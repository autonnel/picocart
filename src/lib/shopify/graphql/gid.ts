// Shopify global-id (GID) codec. Picocart stores cuids; clients address
// resources by `gid://shopify/{Type}/{cuid}`. Encoding is round-trip exact and
// decoding tolerates a bare cuid so callers may pass either form.

const GID_PREFIX = 'gid://shopify/';

export type GidType =
  | 'Product'
  | 'ProductVariant'
  | 'Order'
  | 'DraftOrder'
  | 'Refund'
  | 'Fulfillment';

export function encodeGid(type: GidType, id: string): string {
  return `${GID_PREFIX}${type}/${id}`;
}

export function decodeGid(gid: string | null | undefined): string {
  if (!gid) return '';
  if (!gid.startsWith(GID_PREFIX)) return gid;
  const rest = gid.slice(GID_PREFIX.length);
  const slash = rest.indexOf('/');
  if (slash === -1) return rest;
  const idPart = rest.slice(slash + 1);
  const query = idPart.indexOf('?');
  return query === -1 ? idPart : idPart.slice(0, query);
}

export function gidType(gid: string | null | undefined): GidType | null {
  if (!gid || !gid.startsWith(GID_PREFIX)) return null;
  const rest = gid.slice(GID_PREFIX.length);
  const slash = rest.indexOf('/');
  const type = slash === -1 ? rest : rest.slice(0, slash);
  return type as GidType;
}
