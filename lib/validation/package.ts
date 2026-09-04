import { z } from "zod";

const slugField = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(48)
  .regex(/^[a-z0-9-]+$/, "Slug may contain only a-z, 0-9 and hyphen");

export const createPackageSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(60),
  slug: slugField,
  description: z.string().trim().max(200).optional().or(z.literal("")),
  // 0 = lifetime / non-expiring. Capped so a typo cannot mint a 10,000-year key.
  durationDays: z.coerce.number().int().min(0).max(36_500),
  // Price in minor units (cents), presentation only.
  priceCents: z.coerce.number().int().min(0).max(10_000_000).default(0),
});

export const updatePackageSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  description: z.string().trim().max(200).nullable().optional(),
  durationDays: z.coerce.number().int().min(0).max(36_500).optional(),
  priceCents: z.coerce.number().int().min(0).max(10_000_000).optional(),
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
});

export type CreatePackageInput = z.infer<typeof createPackageSchema>;
export type UpdatePackageInput = z.infer<typeof updatePackageSchema>;
