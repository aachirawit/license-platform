import { redirect } from "next/navigation";
import Link from "next/link";
import { KeyRound } from "lucide-react";

import { getCurrentAdmin } from "@/lib/auth/context";
import { permissionsFor } from "@/lib/auth/rbac";
import { listApps } from "@/lib/services/app-service";
import { resolveCurrentApp } from "@/lib/current-app";
import { Sidebar } from "@/components/layout/sidebar";
import { AppSwitcher } from "@/components/layout/app-switcher";
import { UserMenu } from "@/components/layout/user-menu";

export const runtime = "nodejs";
// Always dynamic: the layout reads the session cookie and per-request data.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");

  const permissions = permissionsFor(admin.role);
  const apps = await listApps();
  const currentApp = await resolveCurrentApp(apps);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur">
        <Link href="/dashboard" className="flex items-center gap-2 pr-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
            <KeyRound className="h-4 w-4" />
          </span>
          <span className="hidden text-sm font-semibold sm:inline">License Platform</span>
        </Link>

        <AppSwitcher
          apps={apps}
          currentSlug={currentApp?.slug ?? null}
          canCreate={permissions.includes("app.write")}
        />

        <div className="flex-1" />

        <UserMenu name={admin.name} email={admin.email} role={admin.role} />
      </header>

      <div className="flex flex-1">
        {/* Sidebar — collapses to icons/hidden on small screens via width. */}
        <aside className="hidden w-56 shrink-0 border-r border-border md:block">
          <Sidebar permissions={permissions} />
        </aside>

        <main className="min-w-0 flex-1 bg-background">{children}</main>
      </div>
    </div>
  );
}
