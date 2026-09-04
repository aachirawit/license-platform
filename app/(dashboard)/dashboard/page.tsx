import Link from "next/link";
import {
  Ban,
  Boxes,
  CircleSlash,
  Clock,
  KeyRound,
  ShieldCheck,
} from "lucide-react";

import { requirePermission } from "@/lib/auth/context";
import {
  getActivitySeries,
  getOverview,
  getRecentActivity,
  getStatusDistribution,
} from "@/lib/services/analytics-service";
import { actionLabel } from "@/lib/activity-labels";
import { relativeTime } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { ActivityChart, StatusChart } from "@/components/dashboard/charts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Platform-wide overview (all apps). Analytics scoped to a single app lives on
// the Analytics page.
export default async function DashboardPage() {
  await requirePermission("analytics.read");

  const [overview, distribution, series, recent] = await Promise.all([
    getOverview(),
    getStatusDistribution(),
    getActivitySeries(30),
    getRecentActivity(8),
  ]);

  return (
    <div>
      <PageHeader title="Dashboard" description="Platform-wide overview across all applications." />

      <div className="space-y-6 p-6">
        {/* Stat tiles */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Apps" value={overview.apps} icon={Boxes} />
          <StatCard label="Licenses" value={overview.licenses} icon={KeyRound} />
          <StatCard label="Active" value={overview.active} icon={ShieldCheck} accent="primary" />
          <StatCard label="Unused" value={overview.unused} icon={Clock} accent="muted" />
          <StatCard label="Expired" value={overview.expired} icon={CircleSlash} accent="warning" />
          <StatCard label="Banned" value={overview.banned} icon={Ban} accent="danger" />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Activity — last 30 days</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityChart data={series} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>License status</CardTitle>
            </CardHeader>
            <CardContent>
              <StatusChart data={distribution} />
            </CardContent>
          </Card>
        </div>

        {/* Recent activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {recent.map((r) => (
                  <li key={r.id} className="flex items-center justify-between py-2.5 text-sm">
                    <span>
                      <span className="font-medium">{r.by ?? "System"}</span>{" "}
                      <span className="text-muted-foreground">{actionLabel(r.action)}</span>
                      {r.appName && <span className="text-muted-foreground"> · {r.appName}</span>}
                    </span>
                    <span className="text-xs text-muted-foreground">{relativeTime(r.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="text-center">
          <Link href="/analytics" className="text-sm text-primary hover:underline">
            View full analytics →
          </Link>
        </div>
      </div>
    </div>
  );
}
