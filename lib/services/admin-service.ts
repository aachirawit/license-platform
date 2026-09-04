import type { Admin } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { Errors } from "@/lib/http/errors";
import { hashPassword } from "@/lib/security/password";
import { revokeAllSessions } from "@/lib/auth/session";
import type { CreateAdminInput, UpdateAdminInput } from "@/lib/validation/admin";

// Admin account management. Writes are SUPER_ADMIN-only (enforced by the route's
// admin.write permission). The password hash is never returned. Two safety
// rails prevent a super admin from locking everyone out: the last SUPER_ADMIN
// cannot be demoted or disabled.

export interface AdminDto {
  id: string;
  email: string;
  name: string;
  role: "SUPER_ADMIN" | "ADMIN" | "SUPPORT" | "READ_ONLY";
  disabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

function toDto(a: Admin): AdminDto {
  return {
    id: a.id,
    email: a.email,
    name: a.name,
    role: a.role,
    disabled: a.disabled,
    lastLoginAt: a.lastLoginAt?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
  };
}

export async function listAdmins(): Promise<AdminDto[]> {
  const admins = await prisma.admin.findMany({ orderBy: { createdAt: "asc" } });
  return admins.map(toDto);
}

export async function createAdmin(input: CreateAdminInput): Promise<AdminDto> {
  const existing = await prisma.admin.findUnique({ where: { email: input.email } });
  if (existing) throw Errors.conflict(`An admin with email ${input.email} already exists`);

  const admin = await prisma.admin.create({
    data: {
      email: input.email,
      name: input.name,
      role: input.role,
      passwordHash: await hashPassword(input.password),
    },
  });
  return toDto(admin);
}

async function countOtherSuperAdmins(excludeId: string): Promise<number> {
  return prisma.admin.count({
    where: { role: "SUPER_ADMIN", disabled: false, id: { not: excludeId } },
  });
}

export async function updateAdmin(id: string, input: UpdateAdminInput): Promise<AdminDto> {
  const current = await prisma.admin.findUnique({ where: { id } });
  if (!current) throw Errors.notFound("ADMIN_NOT_FOUND", "Admin not found");

  // Guard the last active super admin.
  const demoting = input.role && input.role !== "SUPER_ADMIN" && current.role === "SUPER_ADMIN";
  const disabling = input.disabled === true && current.role === "SUPER_ADMIN";
  if ((demoting || disabling) && (await countOtherSuperAdmins(id)) === 0) {
    throw Errors.conflict("You cannot remove the last active super admin");
  }

  const admin = await prisma.admin.update({
    where: { id },
    data: {
      name: input.name,
      role: input.role,
      disabled: input.disabled,
      passwordHash: input.password ? await hashPassword(input.password) : undefined,
    },
  });

  // A role change, disable, or password reset invalidates existing sessions so
  // the new authority takes effect immediately.
  if (input.role !== undefined || input.disabled !== undefined || input.password) {
    await revokeAllSessions(id);
  }

  return toDto(admin);
}
