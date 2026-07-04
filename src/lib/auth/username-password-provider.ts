// Default AuthProvider — username + password against the User table.
// First registration on a tenant becomes admin; subsequent registrations
// require a valid UserInvitation token.

import type { User } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentTenantId } from '@/lib/tenant/context';
import { createLogger } from '@/lib/logger';
import { hashPassword, verifyPassword } from './password';
import { SESSION_COOKIE_NAME, validateSession, createSession, deleteSession } from './session';
import { SYSTEM_ROLE_NAMES } from '@/lib/permissions/config';

const logger = createLogger('UsernamePasswordAuth');

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface LoginInput {
  username: string;
  password: string;
}

export interface RegisterInput {
  username: string;
  password: string;
  email?: string;
  invitationToken?: string;
}

export interface InviteInput {
  email: string;
  role: string;
  invitedById?: string;
}

export interface AuthProvider {
  name: string;
  verifySession(request: Request): Promise<User | null>;
}

function readSessionToken(request: Request): string | undefined {
  const cookieHeader = request.headers.get('cookie') ?? '';
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE_NAME) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return undefined;
}

async function assignRoleByName(userId: string, tenantId: string, roleName: string): Promise<void> {
  const role = await prisma.role.findUnique({
    where: { tenantId_name: { tenantId, name: roleName } },
  });
  if (!role) {
    logger.warn('Role not found when assigning to user', { roleName, tenantId });
    return;
  }
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId, roleId: role.id } },
    create: { tenantId, userId, roleId: role.id },
    update: {},
  });
}

export async function login(input: LoginInput): Promise<User> {
  const tenantId = getCurrentTenantId();
  const user = await prisma.user.findUnique({
    where: { tenantId_username: { tenantId, username: input.username } },
  });
  if (!user || !user.passwordHash) {
    throw new Error('Invalid credentials');
  }
  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) {
    throw new Error('Invalid credentials');
  }
  return user;
}

export async function register(input: RegisterInput): Promise<User> {
  const tenantId = getCurrentTenantId();

  if (!input.username || input.username.length < 3) {
    throw new Error('Username must be at least 3 characters');
  }

  const existing = await prisma.user.findUnique({
    where: { tenantId_username: { tenantId, username: input.username } },
  });
  if (existing) {
    throw new Error('Username already taken');
  }

  const userCount = await prisma.user.count({ where: { tenantId } });
  const isFirstUser = userCount === 0;

  let invitationRoleName: string | undefined;
  let invitationId: string | undefined;

  if (!isFirstUser) {
    if (!input.invitationToken) {
      throw new Error('Registration requires an invitation token');
    }
    const invitation = await prisma.userInvitation.findUnique({
      where: { token: input.invitationToken },
    });
    if (!invitation || invitation.tenantId !== tenantId) {
      throw new Error('Invalid invitation token');
    }
    if (invitation.acceptedAt) {
      throw new Error('Invitation already used');
    }
    if (invitation.expiresAt < new Date()) {
      throw new Error('Invitation expired');
    }
    invitationRoleName = invitation.role;
    invitationId = invitation.id;
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      tenantId,
      username: input.username,
      passwordHash,
      email: input.email ?? null,
    },
  });

  const roleName = isFirstUser ? SYSTEM_ROLE_NAMES.ADMIN : (invitationRoleName ?? SYSTEM_ROLE_NAMES.VIEWER);
  await assignRoleByName(user.id, tenantId, roleName);

  if (invitationId) {
    await prisma.userInvitation.update({
      where: { id: invitationId },
      data: { acceptedAt: new Date() },
    });
  }

  logger.info('User registered', { userId: user.id, isFirstUser, role: roleName });
  return user;
}

export async function logout(request: Request): Promise<void> {
  const token = readSessionToken(request);
  if (token) {
    await deleteSession(token);
  }
}

function generateInvitationToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createInvitation(input: InviteInput): Promise<{ token: string; expiresAt: Date }> {
  const tenantId = getCurrentTenantId();
  const token = generateInvitationToken();
  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
  await prisma.userInvitation.create({
    data: {
      tenantId,
      email: input.email,
      invitedById: input.invitedById ?? null,
      role: input.role,
      token,
      expiresAt,
    },
  });
  return { token, expiresAt };
}

async function verifySession(request: Request): Promise<User | null> {
  const token = readSessionToken(request);
  if (!token) return null;
  const result = await validateSession(token);
  if (!result) return null;
  if (result.session.tenantId !== getCurrentTenantId()) return null;
  return result.user;
}

export const usernamePasswordProvider: AuthProvider = {
  name: 'username-password',
  verifySession,
};

export { createSession, SESSION_COOKIE_NAME };
