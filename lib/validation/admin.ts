import { z } from "zod";

const roleField = z.enum(["SUPER_ADMIN", "ADMIN", "SUPPORT", "READ_ONLY"]);

export const createAdminSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  name: z.string().trim().min(2, "Name is required").max(80),
  role: roleField.default("READ_ONLY"),
  // New admin passwords must be reasonable; the real strength gate is argon2 +
  // that this endpoint is SUPER_ADMIN-only.
  password: z.string().min(10, "Use at least 10 characters").max(200),
});

export const updateAdminSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    role: roleField.optional(),
    disabled: z.boolean().optional(),
    // Optional password reset.
    password: z.string().min(10).max(200).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

export type CreateAdminInput = z.infer<typeof createAdminSchema>;
export type UpdateAdminInput = z.infer<typeof updateAdminSchema>;
