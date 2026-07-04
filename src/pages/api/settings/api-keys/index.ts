import type { APIRoute } from 'astro';
import { z } from 'zod';
import { withAuth, jsonResponse } from '@/lib/api-helpers';
import { FEATURES } from '@/lib/permissions';
import { prisma } from '@/lib/db';
import { withTenantWhere } from '@/lib/repositories/tenant-helpers';
import { getCurrentTenantId } from '@/lib/tenant/context';
import { createLogger } from '@/lib/logger';

const logger = createLogger('Api:SettingsApiKeys');

const CreateSchema = z.object({
  name: z.string().min(1).max(80),
  writeAccess: z.boolean().optional(),
  expiresAt: z.string().nullable().optional(),
});

function publicShape(row: any) {
  return {
    id: row.id,
    name: row.name,
    writeAccess: row.writeAccess,
    isActive: row.isActive,
    keyPreview: row.key ? `${row.key.slice(0, 6)}...${row.key.slice(-4)}` : '',
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
  };
}

async function hashKey(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return (
    'pc_' +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  );
}

export const GET: APIRoute = withAuth(FEATURES.SETTINGS_API_KEYS, async () => {
  const keys = await prisma.apiKey.findMany({
    where: withTenantWhere({}),
    orderBy: { createdAt: 'desc' },
  });
  return jsonResponse({ apiKeys: keys.map(publicShape) });
});

export const POST: APIRoute = withAuth(FEATURES.SETTINGS_API_KEYS, async ({ request }, { user }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ error: 'VALIDATION', issues: parsed.error.issues }, 400);
  }
  try {
    const tenantId = getCurrentTenantId();
    const token = generateToken();
    const keyHash = await hashKey(token);
    const created = await prisma.apiKey.create({
      data: {
        tenantId,
        userId: user.id,
        name: parsed.data.name,
        key: token,
        keyHash,
        writeAccess: parsed.data.writeAccess ?? false,
        isActive: true,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      },
    });
    return jsonResponse(
      {
        apiKey: publicShape(created),
        token,
      },
      201,
    );
  } catch (error) {
    logger.error('Create api key failed', { error });
    return jsonResponse({ error: 'Failed to create API key' }, 500);
  }
});
