import { Boxes } from "lucide-react";

import { requirePermission } from "@/lib/auth/context";
import { permissionsFor } from "@/lib/auth/rbac";
import { isAtLeast } from "@/lib/auth/context";
import { listApps } from "@/lib/services/app-service";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { AppCard } from "@/components/apps/app-card";
import { CreateAppDialog } from "@/components/apps/create-app-dialog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AppsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  // Page-level authorization: the layout proved a session; this proves the
  // permission for this specific area.
  const admin = await requirePermission("app.read");
  const permissions = permissionsFor(admin.role);
  const canWrite = permissions.includes("app.write");
  const canDelete = isAtLeast(admin.role, "SUPER_ADMIN");

  const apps = await listApps();
  const { new: openNew } = await searchParams;

  return (
    <div>
      <PageHeader
        title="Applications"
        description="Each application is an isolated set of licenses, packages and keys."
        actions={canWrite ? <CreateAppDialog openByDefault={openNew === "1"} /> : undefined}
      />

      <div className="p-6">
        {apps.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title="No applications yet"
            description="Create your first application to start issuing licenses."
            action={canWrite ? <CreateAppDialog /> : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {apps.map((app) => (
              <AppCard key={app.id} app={app} canWrite={canWrite} canDelete={canDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
