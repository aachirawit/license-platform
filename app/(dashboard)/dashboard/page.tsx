import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/lib/auth/context";

export const runtime = "nodejs";

// Minimal authed page for Phase 3 - proves the full session loop end to end.
// The real dashboard (stats, charts, activity) is built in Phase 7 and will
// replace this body while keeping the same server-side auth guard.
export default async function DashboardPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Signed in as {admin.name} · {admin.email} · role {admin.role}
      </p>
      <div className="mt-6 rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
        Auth, sessions and RBAC are live. The full dashboard, apps, licenses,
        analytics, security and admin management arrive in the following phases.
      </div>
    </main>
  );
}
