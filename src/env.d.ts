/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    /** Tenant ID resolved by middleware from the request host. */
    tenantId?: string;
  }
}

interface Env {
  CACHE_KV: KVNamespace;
  HYPERDRIVE: Hyperdrive;
  [key: string]: unknown;
}
