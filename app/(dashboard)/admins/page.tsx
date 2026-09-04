import { requirePermission } from "@/lib/auth/context";
import { permissionsFor } from "@/lib/auth/rbac";
import { listAdmins } from "@/lib/services/admin-service";
import { PageHeader } from "@/components/layout/page-header";
import { AdminsView } from "@/components/admins/admins-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminsPage() {
  const admin = await requirePermission("admin.read");
  const permissions = permissionsFor(admin.role);
  const admins = await listAdmins();

  return (
    <div>
      <PageHeader
        title="Admins"
        description="Manage who can access the platform and what they can do."
      />
      <div className="p-6">
        <AdminsView
          initialAdmins={admins}
          currentAdminId={admin.id}
          canWrite={permissions.includes("admin.write")}
        />
      </div>
    </div>
  );
}
