import type { App } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { Errors } from "@/lib/http/errors";
import type { CreateAppInput, UpdateAppInput } from "@/lib/validation/app";

// App CRUD. Every write is performed by an already-authorized admin (the route
// checks the permission) and returns a DTO safe for the browser - notably
// providerConfig is NEVER included in list/detail DTOs, because it may hold
// provider configuration that should not reach the client.

export interface AppDto {
  id: string;
  name: string;
  slug: string;
  appId: string;
  description: string | null;
  icon: string | null;
  status: "ACTIVE" | "DISABLED";
  provider: "MOCK" | "KEYAUTH";
  keyPrefix: string;
  createdAt: string;
  updatedAt: string;
  // Aggregate counts for the app cards; filled by listApps.
  licenseCount?: number;
  activeLicenseCount?: number;
}

function toDto(app: App, counts?: { total: number; active: number }): AppDto {
  return {
    id: app.id,
    name: app.name,
    slug: app.slug,
    appId: app.appId,
    description: app.description,
    icon: app.icon,
    status: app.status,
    provider: app.provider,
    keyPrefix: app.keyPrefix ?? deriveKeyPrefix(app.appId),
    createdAt: app.createdAt.toISOString(),
    updatedAt: app.updatedAt.toISOString(),
    licenseCount: counts?.total,
    activeLicenseCount: counts?.active,
  };
}

/** A 4-char key prefix derived from the app id when none is set. */
export function deriveKeyPrefix(appId: string): string {
  const letters = appId.replace(/[^A-Z0-9]/g, "");
  return (letters.slice(0, 4) || "KEY").toUpperCase();
}

export async function listApps(): Promise<AppDto[]> {
  const apps = await prisma.app.findMany({ orderBy: { createdAt: "asc" } });

  // One grouped count query rather than N per-app counts.
  const grouped = await prisma.license.groupBy({
    by: ["appId", "status"],
    _count: { _all: true },
  });

  const totals = new Map<string, { total: number; active: number }>();
  for (const row of grouped) {
    const entry = totals.get(row.appId) ?? { total: 0, active: 0 };
    entry.total += row._count._all;
    if (row.status === "ACTIVE") entry.active += row._count._all;
    totals.set(row.appId, entry);
  }

  return apps.map((a) => toDto(a, totals.get(a.id) ?? { total: 0, active: 0 }));
}

/** Load an app by id or slug, throwing APP_NOT_FOUND when absent. */
export async function getAppOrThrow(idOrSlug: string): Promise<App> {
  const app = await prisma.app.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
  });
  if (!app) throw Errors.notFound("APP_NOT_FOUND", "Application not found");
  return app;
}

export async function getApp(idOrSlug: string): Promise<AppDto> {
  return toDto(await getAppOrThrow(idOrSlug));
}

export async function createApp(input: CreateAppInput): Promise<AppDto> {
  // slug and appId are globally unique; surface a friendly conflict rather than
  // a raw Prisma error.
  const clash = await prisma.app.findFirst({
    where: { OR: [{ slug: input.slug }, { appId: input.appId }] },
    select: { slug: true, appId: true },
  });
  if (clash) {
    throw Errors.conflict(
      clash.slug === input.slug
        ? `An app with slug "${input.slug}" already exists`
        : `An app with ID "${input.appId}" already exists`,
    );
  }

  const app = await prisma.app.create({
    data: {
      name: input.name,
      slug: input.slug,
      appId: input.appId,
      description: input.description || null,
      icon: input.icon || null,
      keyPrefix: input.keyPrefix || deriveKeyPrefix(input.appId),
      provider: input.provider,
      status: "ACTIVE",
    },
  });
  return toDto(app);
}

export async function updateApp(id: string, input: UpdateAppInput): Promise<AppDto> {
  await getAppOrThrow(id);
  const app = await prisma.app.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description === undefined ? undefined : input.description,
      icon: input.icon === undefined ? undefined : input.icon,
      keyPrefix: input.keyPrefix === undefined ? undefined : input.keyPrefix,
      status: input.status,
      provider: input.provider,
    },
  });
  return toDto(app);
}

/**
 * Delete an app. This cascades to its packages and licences (see the schema),
 * so it is destructive and the route restricts it to SUPER_ADMIN. Returns the
 * number of licences that were removed for the audit trail.
 */
export async function deleteApp(id: string): Promise<{ removedLicenses: number }> {
  await getAppOrThrow(id);
  const removedLicenses = await prisma.license.count({ where: { appId: id } });
  await prisma.app.delete({ where: { id } });
  return { removedLicenses };
}
