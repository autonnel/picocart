import { prisma } from '@/lib/db';
import type { FeatureId } from './config';
import { invalidateAllPermissionCaches, invalidateUserRolesCache } from './cache';
import { getCurrentTenantId } from '@/lib/tenant/context';

export interface RoleRecord {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoleWithFeatures extends RoleRecord {
  features: FeatureId[];
}

export interface UserWithRoles {
  id: string;
  email: string | null;
  name: string | null;
  avatar: string | null;
  roles: Array<{ id: string; name: string }>;
}

export interface IPermissionRepository {
  listRoles(): Promise<RoleRecord[]>;
  getRoleById(id: string): Promise<RoleRecord | null>;
  getRoleByName(name: string): Promise<RoleRecord | null>;
  createRole(input: { name: string; description?: string | null; isSystem?: boolean }): Promise<RoleRecord>;
  updateRole(id: string, data: { name?: string; description?: string | null }): Promise<RoleRecord>;
  deleteRole(id: string): Promise<void>;

  listRoleFeatures(roleId: string): Promise<FeatureId[]>;
  setRoleFeatures(roleId: string, featureIds: FeatureId[]): Promise<void>;

  getUserRoleNames(userId: string): Promise<string[]>;
  getUserRoles(userId: string): Promise<RoleRecord[]>;
  assignUserRole(userId: string, roleId: string): Promise<void>;
  removeUserRole(userId: string, roleId: string): Promise<void>;
  setUserRoles(userId: string, roleIds: string[]): Promise<void>;

  listAllUsersWithRoles(): Promise<UserWithRoles[]>;
  listUsers(): Promise<Array<{ id: string; email: string | null; name: string | null; avatar: string | null }>>;
}

export class PrismaPermissionRepository implements IPermissionRepository {
  async listRoles(): Promise<RoleRecord[]> {
    const tenantId = getCurrentTenantId();
    return prisma.role.findMany({
      where: { tenantId },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
  }

  async getRoleById(id: string): Promise<RoleRecord | null> {
    const tenantId = getCurrentTenantId();
    return prisma.role.findFirst({ where: { id, tenantId } });
  }

  async getRoleByName(name: string): Promise<RoleRecord | null> {
    const tenantId = getCurrentTenantId();
    return prisma.role.findUnique({ where: { tenantId_name: { tenantId, name } } });
  }

  async createRole(input: { name: string; description?: string | null; isSystem?: boolean }): Promise<RoleRecord> {
    const tenantId = getCurrentTenantId();
    const role = await prisma.role.create({
      data: {
        tenantId,
        name: input.name,
        description: input.description ?? null,
        isSystem: input.isSystem ?? false,
      },
    });
    await invalidateAllPermissionCaches();
    return role;
  }

  async updateRole(id: string, data: { name?: string; description?: string | null }): Promise<RoleRecord> {
    const tenantId = getCurrentTenantId();
    const existing = await prisma.role.findFirst({ where: { id, tenantId } });
    if (!existing) throw new Error(`Role ${id} not found`);
    if (existing.isSystem && data.name && data.name !== existing.name) {
      throw new Error('System role name cannot be changed');
    }
    const role = await prisma.role.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
      },
    });
    await invalidateAllPermissionCaches();
    return role;
  }

  async deleteRole(id: string): Promise<void> {
    const tenantId = getCurrentTenantId();
    const existing = await prisma.role.findFirst({ where: { id, tenantId } });
    if (!existing) return;
    if (existing.isSystem) {
      throw new Error('System roles cannot be deleted');
    }
    await prisma.role.delete({ where: { id } });
    await invalidateAllPermissionCaches();
  }

  async listRoleFeatures(roleId: string): Promise<FeatureId[]> {
    const rows = await prisma.roleFeature.findMany({
      where: { roleId },
      select: { featureId: true },
    });
    return rows.map((r) => r.featureId as FeatureId);
  }

  async setRoleFeatures(roleId: string, featureIds: FeatureId[]): Promise<void> {
    const tenantId = getCurrentTenantId();
    const unique = Array.from(new Set(featureIds));
    await prisma.$transaction(async (tx) => {
      await tx.roleFeature.deleteMany({ where: { roleId } });
      if (unique.length > 0) {
        await tx.roleFeature.createMany({
          data: unique.map((featureId) => ({ tenantId, roleId, featureId })),
        });
      }
    });
    await invalidateAllPermissionCaches();
  }

  async getUserRoleNames(userId: string): Promise<string[]> {
    const tenantId = getCurrentTenantId();
    const rows = await prisma.userRole.findMany({
      where: { userId, tenantId },
      select: { role: { select: { name: true } } },
    });
    return rows.map((r) => r.role.name);
  }

  async getUserRoles(userId: string): Promise<RoleRecord[]> {
    const tenantId = getCurrentTenantId();
    const rows = await prisma.userRole.findMany({
      where: { userId, tenantId },
      include: { role: true },
    });
    return rows.map((r) => r.role);
  }

  async assignUserRole(userId: string, roleId: string): Promise<void> {
    const tenantId = getCurrentTenantId();
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      create: { tenantId, userId, roleId },
      update: {},
    });
    await invalidateUserRolesCache(userId);
  }

  async removeUserRole(userId: string, roleId: string): Promise<void> {
    await prisma.userRole.deleteMany({ where: { userId, roleId } });
    await invalidateUserRolesCache(userId);
  }

  async setUserRoles(userId: string, roleIds: string[]): Promise<void> {
    const tenantId = getCurrentTenantId();
    const unique = Array.from(new Set(roleIds));
    await prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId } });
      if (unique.length > 0) {
        await tx.userRole.createMany({
          data: unique.map((roleId) => ({ tenantId, userId, roleId })),
        });
      }
    });
    await invalidateUserRolesCache(userId);
  }

  async listAllUsersWithRoles(): Promise<UserWithRoles[]> {
    const tenantId = getCurrentTenantId();
    const users = await prisma.user.findMany({
      where: { tenantId },
      include: {
        roles: { include: { role: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      avatar: u.avatar,
      roles: u.roles.map((ur) => ({ id: ur.role.id, name: ur.role.name })),
    }));
  }

  async listUsers() {
    const tenantId = getCurrentTenantId();
    return prisma.user.findMany({
      where: { tenantId },
      select: { id: true, email: true, name: true, avatar: true },
      orderBy: { createdAt: 'asc' },
    });
  }
}

let instance: IPermissionRepository = new PrismaPermissionRepository();

export function getPermissionRepository(): IPermissionRepository {
  return instance;
}

export function setPermissionRepository(repo: IPermissionRepository): void {
  instance = repo;
}
