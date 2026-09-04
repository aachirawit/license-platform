import { Boxes } from "lucide-react";

import { requirePermission } from "@/lib/auth/context";
import { listApps } from "@/lib/services/app-service";
import { resolveCurrentApp } from "@/lib/current-app";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { AnalyticsView } from "@/components/analytics/analytics-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  await requirePermission("analytics.read");
  const apps = await listApps();
  const app = await resolveCurrentApp(apps);

  return (
    <div>
      <PageHeader
        title="Analytics"
        description={app ? `Scoped to ${app.name}.` : "Create an application to see analytics."}
      />
      <div className="p-6">
        {app ? (
          <AnalyticsView key={app.id} appSlug={app.slug} />
        ) : (
          <EmptyState icon={Boxes} title="No applications yet" />
        )}
      </div>
    </div>
  );
}
