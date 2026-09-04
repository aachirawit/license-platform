import { z } from "zod";

// Generation: quantity + an optional package + an optional duration override.
// When durationDays is omitted, the service falls back to the package's
// duration; when the package is omitted too, it defaults to lifetime.
export const generateLicensesSchema = z.object({
  quantity: z.coerce.number().int().min(1, "At least 1").max(500, "At most 500 at a time"),
  packageId: z.string().min(1).optional(),
  // 0 = lifetime. null/omitted = inherit from package.
  durationDays: z.coerce.number().int().min(0).max(36_500).nullable().optional(),
});

export const licenseFiltersSchema = z.object({
  status: z.enum(["UNUSED", "ACTIVE", "EXPIRED", "BANNED", "REVOKED"]).optional(),
  packageId: z.string().optional(),
  search: z.string().trim().max(64).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const banLicenseSchema = z.object({
  reason: z.string().trim().max(200).optional(),
});

export const revokeLicenseSchema = z.object({
  reason: z.string().trim().max(200).optional(),
});

export const extendLicenseSchema = z.object({
  days: z.coerce.number().int().min(1, "At least 1 day").max(36_500),
});

export type GenerateLicensesInput = z.infer<typeof generateLicensesSchema>;
export type LicenseFilters = z.infer<typeof licenseFiltersSchema>;
