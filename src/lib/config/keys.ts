// AppConfig key registry — single source of truth for env vars that are
// per-tenant overridable via the `app_configs` KV table.
//
// Naming convention: lowercase dotted (e.g. `oauth.client_id`). Once published,
// KV keys MUST NOT be renamed — SaaS tenants may have written rows against them.
//
// Read order: KV row -> env fallback -> undefined.

import { getConfig } from './get-config';

export interface ConfigKey<T = unknown> {
  /** Stable KV key (never rename). */
  key: string;
  /** Env var name to fall back to when no KV row is present. */
  envFallback: string;
  /** Phantom marker for the runtime value type. */
  __t?: T;
}

function k<T>(key: string, envFallback: string): ConfigKey<T> {
  return { key, envFallback };
}

export const ConfigKeys = {
  // S3 / storage credentials (object stored as JSON).
  STORAGE_S3:             k<unknown>('storage.s3',             'STORAGE_S3'),

  // OAuth slots (consumed by the optional OAuth2 login plugin when installed).
  OAUTH_CLIENT_ID:         k<string>('oauth.client_id',         'OAUTH_CLIENT_ID'),
  OAUTH_CLIENT_SECRET:     k<string>('oauth.client_secret',     'OAUTH_CLIENT_SECRET'),
  OAUTH_AUTHORIZATION_URL: k<string>('oauth.authorization_url', 'OAUTH_AUTHORIZATION_URL'),
  OAUTH_TOKEN_URL:         k<string>('oauth.token_url',         'OAUTH_TOKEN_URL'),
  OAUTH_USER_INFO_URL:     k<string>('oauth.user_info_url',     'OAUTH_USER_INFO_URL'),
  OAUTH_REDIRECT_URI:      k<string>('oauth.redirect_uri',      'OAUTH_REDIRECT_URI'),
  OAUTH_SCOPES:            k<string>('oauth.scopes',            'OAUTH_SCOPES'),

  DEFAULT_CDN_URL:        k<string>('cdn.default_url',        'DEFAULT_CDN_URL'),

  PERMISSIONS_ADMIN_USER_IDS: k<string>('permissions.admin_user_ids', 'PERMISSIONS_ADMIN_USER_IDS'),

  MQ_DEFAULT_TOPIC:       k<string>('mq.default_topic',       'MQ_DEFAULT_TOPIC'),
} as const;

export type ConfigKeyName = keyof typeof ConfigKeys;

/** Generic helper: read any config key via its registered (key, envFallback) pair. */
export async function readConfigKey<T = string>(spec: ConfigKey<T>): Promise<T | undefined> {
  return getConfig<T>(spec.key, spec.envFallback);
}

// Typed accessors — prefer these over readConfigKey to keep call sites stable.

export const getOAuthClientId        = () => readConfigKey<string>(ConfigKeys.OAUTH_CLIENT_ID);
export const getOAuthClientSecret    = () => readConfigKey<string>(ConfigKeys.OAUTH_CLIENT_SECRET);
export const getOAuthAuthorizationUrl = () => readConfigKey<string>(ConfigKeys.OAUTH_AUTHORIZATION_URL);
export const getOAuthTokenUrl        = () => readConfigKey<string>(ConfigKeys.OAUTH_TOKEN_URL);
export const getOAuthUserInfoUrl     = () => readConfigKey<string>(ConfigKeys.OAUTH_USER_INFO_URL);
export const getOAuthRedirectUri     = () => readConfigKey<string>(ConfigKeys.OAUTH_REDIRECT_URI);
export const getOAuthScopes          = () => readConfigKey<string>(ConfigKeys.OAUTH_SCOPES);

export const getDefaultCdnUrl        = () => readConfigKey<string>(ConfigKeys.DEFAULT_CDN_URL);

export const getPermissionsAdminIdsRaw = () => readConfigKey<string>(ConfigKeys.PERMISSIONS_ADMIN_USER_IDS);

export const getMqDefaultTopic       = () => readConfigKey<string>(ConfigKeys.MQ_DEFAULT_TOPIC);
