import type { LicensePackage } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { Errors } from "@/lib/http/errors";
import type { CreatePackageInput, UpdatePackageInput } from "@/lib/validation/package";

// Package CRUD, always scoped to an app. A package cannot be read or mutated
// across app boundaries: getPackageOrThrow takes the appId and refuses a
// package that belongs elsewhere, so multi-app isolation holds at the service
// layer, not just in the UI.

export interface PackageDto {
  id: string;
  appId: string;
  name: string;
  slug: string;
  description: string | null;
  durationDays: number;
  priceCents: number;
  status: "ACTIVE" | "DISABLED";
  licenseCount?: number;
  createdAt: string;
  updatedAt: string;
}

function toDto(pkg: LicensePackage, licenseCount?: number): PackageDto {
  return {
    id: pkg.id,
    appId: pkg.appId,
    name: pkg.name,
    slug: pkg.slug,
    description: pkg.description,
    durationDays: pkg.durationDays,
    priceCents: pkg.priceCents,
    status: pkg.status,
    licenseCount,
    createdAt: pkg.createdAt.toISOString(),
    updatedAt: pkg.updatedAt.toISOString(),
  };
}

export async function listPackages(appId: string): Promise<PackageDto[]> {
  const packages = await prisma.licensePackage.findMany({
    where: { appId },
    orderBy: { durationDays: "asc" },
  });

  const counts = await prisma.license.groupBy({
    by: ["packageId"],
    where: { appId },
    _count: { _all: true },
  });
  const byPackage = new Map(counts.map((c) => [c.packageId, c._count._all]));

  return packages.map((p) => toDto(p, byPackage.get(p.id) ?? 0));
}

/** Load a package and confirm it belongs to `appId`, else PACKAGE_NOT_FOUND. */
export async function getPackageOrThrow(
  appId: string,
  packageId: string,
): Promise<LicensePackage> {
  const pkg = await prisma.licensePackage.findUnique({ where: { id: packageId } });
  if (!pkg || pkg.appId !== appId) {
    throw Errors.notFound("PACKAGE_NOT_FOUND", "Package not found for this application");
  }
  return pkg;
}

export async function createPackage(
  appId: string,
  input: CreatePackageInput,
): Promise<PackageDto> {
  const clash = await prisma.licensePackage.findUnique({
    where: { appId_slug: { appId, slug: input.slug } },
  });
  if (clash) throw Errors.conflict(`A package with slug "${input.slug}" already exists`);

  const pkg = await prisma.licensePackage.create({
    data: {
      appId,
      name: input.name,
      slug: input.slug,
      description: input.description || null,
      durationDays: input.durationDays,
      priceCents: input.priceCents,
      status: "ACTIVE",
    },
  });
  return toDto(pkg, 0);
}

export async function updatePackage(
  appId: string,
  packageId: string,
  input: UpdatePackageInput,
): Promise<PackageDto> {
  await getPackageOrThrow(appId, packageId);
  const pkg = await prisma.licensePackage.update({
    where: { id: packageId },
    data: {
      name: input.name,
      description: input.description === undefined ? undefined : input.description,
      durationDays: input.durationDays,
      priceCents: input.priceCents,
      status: input.status,
    },
  });
  return toDto(pkg);
}

/**
 * Delete a package. Existing licences keep working - the schema sets their
 * packageId to null on delete rather than cascading - so removing a package
 * never revokes issued keys.
 */
export async function deletePackage(appId: string, packageId: string): Promise<void> {
  await getPackageOrThrow(appId, packageId);
  await prisma.licensePackage.delete({ where: { id: packageId } });
}
