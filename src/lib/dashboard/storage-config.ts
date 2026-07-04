import { getConfig, setConfig } from '@/lib/config/get-config';
import { ConfigKeys } from '@/lib/config/keys';

export interface StorageConfig {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string | null;
  publicBaseUrl?: string | null;
}

export interface StorageConfigPublic {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKeyMasked: string;
  endpoint?: string | null;
  publicBaseUrl?: string | null;
  configured: boolean;
}

function maskSecret(secret: string): string {
  if (!secret) return '';
  if (secret.length <= 4) return '****';
  return `${secret.slice(0, 4)}${'*'.repeat(Math.max(secret.length - 4, 4))}`;
}

export async function getStorageConfig(): Promise<StorageConfig | null> {
  const raw = await getConfig<StorageConfig>(ConfigKeys.STORAGE_S3.key, ConfigKeys.STORAGE_S3.envFallback);
  if (!raw || typeof raw !== 'object') return null;
  if (!raw.bucket || !raw.region || !raw.accessKeyId) return null;
  return raw;
}

export async function getStorageConfigPublic(): Promise<StorageConfigPublic | null> {
  const config = await getStorageConfig();
  if (!config) return null;
  return {
    bucket: config.bucket,
    region: config.region,
    accessKeyId: config.accessKeyId,
    secretAccessKeyMasked: maskSecret(config.secretAccessKey),
    endpoint: config.endpoint ?? null,
    publicBaseUrl: config.publicBaseUrl ?? null,
    configured: true,
  };
}

export async function setStorageConfig(config: StorageConfig): Promise<void> {
  await setConfig(ConfigKeys.STORAGE_S3.key, config);
}

export async function isStorageConfigured(): Promise<boolean> {
  const config = await getStorageConfig();
  return config !== null;
}
