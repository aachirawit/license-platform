import { z } from "zod";

// Shared field rules. appId is the stable identifier a C++ client sends, so it
// is uppercase and restricted; slug is the URL identifier.
const appIdField = z
  .string()
  .trim()
  .toUpperCase()
  .min(2, "App ID must be at least 2 characters")
  .max(32)
  .regex(/^[A-Z0-9_]+$/, "App ID may contain only A-Z, 0-9 and underscore");

const slugField = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Slug must be at least 2 characters")
  .max(48)
  .regex(/^[a-z0-9-]+$/, "Slug may contain only a-z, 0-9 and hyphen");

export const createAppSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(80),
  slug: slugField,
  appId: appIdField,
  description: z.string().trim().max(280).optional().or(z.literal("")),
  icon: z.string().trim().max(40).optional().or(z.literal("")),
  // Per-app key prefix, e.g. "SZKP". Derived from appId when omitted.
  keyPrefix: z
    .string()
    .trim()
    .toUpperCase()
    .max(6)
    .regex(/^[A-Z0-9]*$/, "Prefix may contain only A-Z and 0-9")
    .optional()
    .or(z.literal("")),
  // Only MOCK is selectable for now; KEYAUTH is accepted so an app can be
  // pre-marked, but the adapter fails safely until implemented.
  provider: z.enum(["MOCK", "KEYAUTH"]).default("MOCK"),
});

export const updateAppSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(280).nullable().optional(),
  icon: z.string().trim().max(40).nullable().optional(),
  keyPrefix: z
    .string()
    .trim()
    .toUpperCase()
    .max(6)
    .regex(/^[A-Z0-9]*$/)
    .nullable()
    .optional(),
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
  provider: z.enum(["MOCK", "KEYAUTH"]).optional(),
});

export type CreateAppInput = z.infer<typeof createAppSchema>;
export type UpdateAppInput = z.infer<typeof updateAppSchema>;
