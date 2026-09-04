import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  // Not length-validated on login beyond non-empty: the stored hash decides.
  // Bounded to a sane max so a giant body cannot be forced through argon2.
  password: z.string().min(1, "Password is required").max(200),
});

export type LoginInput = z.infer<typeof loginSchema>;
