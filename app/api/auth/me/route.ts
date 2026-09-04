import { getCurrentAdmin } from "@/lib/auth/context";
import { permissionsFor } from "@/lib/auth/rbac";
import { toErrorResponse } from "@/lib/http/errors";
import { ok } from "@/lib/http/response";

export const runtime = "nodejs";

// Returns the current admin and their resolved permissions, or 200 with
// admin:null when signed out (the client uses this to gate the UI). Password
// hash and session internals are never included.
export async function GET() {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return ok({ admin: null, permissions: [] as string[] }, "OK");
    }
    return ok({
      admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
      permissions: permissionsFor(admin.role),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
