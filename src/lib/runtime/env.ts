/**
 * Runtime Environment Abstraction
 * Provides unified access to environment variables and CF bindings across
 * Node.js and Cloudflare Workers runtimes.
 */

let _cfEnv: Record<string, unknown> | null = null;

// Non-literal import string keeps Rollup from trying to resolve cloudflare:
// at build time while still working at runtime in workerd.
const _cfModuleId = 'cloudflare:' + 'workers';
try {
  const mod = await import(/* @vite-ignore */ _cfModuleId);
  if (mod?.env) {
    _cfEnv = mod.env as Record<string, unknown>;
  }
} catch {
  // Not running on Cloudflare Workers — expected on Node.js
}

function resolveCfEnv(): Record<string, unknown> | null {
  return _cfEnv;
}

/** Manually inject CF env bindings for contexts without an ambient module env. */
export function setCfEnv(env: Record<string, unknown>): void {
  _cfEnv = env;
}

export function getEnv(key: string): string | undefined {
  const cfEnv = resolveCfEnv();
  if (cfEnv) {
    const val = cfEnv[key];
    return typeof val === 'string' ? val : undefined;
  }
  return process.env[key];
}

export function getBinding<T = unknown>(key: string): T | undefined {
  const cfEnv = resolveCfEnv();
  if (cfEnv) {
    return cfEnv[key] as T | undefined;
  }
  return undefined;
}

export function isCloudflareRuntime(): boolean {
  return resolveCfEnv() !== null;
}
