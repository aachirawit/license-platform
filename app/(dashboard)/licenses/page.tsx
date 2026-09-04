import { Boxes } from "lucide-react";

import { requirePermission } from "@/lib/auth/context";
import { permissionsFor } from "@/lib/auth/rbac";
import { listApps } from "@/lib/services/app-service";
import { listPackages } from "@/lib/services/package-service";
import { resolveCurrentApp } from "@/lib/current-app";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { LicenseTable } from "@/components/licenses/license-table";
import { GenerateDialog } from "@/components/licenses/generate-dialog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function LicensesPage() {
  const admin = await requirePermission("license.read");
  const permissions = permissionsFor(admin.role);

  const apps = await listApps();
  const app = await resolveCurrentApp(apps);

  if (!app) {
    return (
      <div>
        <PageHeader title="Licenses" />
        <div className="p-6">
          <EmptyState
            icon={Boxes}
            title="No applications yet"
            description="Create an application before generating licenses."
          />
        </div>
      </div>
    );
  }

  const packages = await listPackages(app.id);
  const perms = {
    ban: permissions.includes("license.ban"),
    extend: permissions.includes("license.extend"),
    resetHwid: permissions.includes("license.reset_hwid"),
  };

  return (
    <div>
      <PageHeader
        title="Licenses"
        description={`Scoped to ${app.name}. Use the app switcher to change scope.`}
        actions={
          permissions.includes("license.generate") ? (
            <GenerateDialog appSlug={app.slug} appName={app.name} packages={packages} />
          ) : undefined
        }
      />
      <div className="p-6">
        {/* keyed by app so switching apps remounts the table with fresh scope */}
        <LicenseTable key={app.id} appSlug={app.slug} packages={packages} perms={perms} />
      </div>
    </div>
  );
}
