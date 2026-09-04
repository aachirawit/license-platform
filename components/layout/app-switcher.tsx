"use client";

import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Plus } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { CURRENT_APP_COOKIE } from "@/lib/constants";
import type { AppDto } from "@/lib/services/app-service";

// Scopes the dashboard to an app. Writing the (non-secret) preference cookie
// client-side avoids an API round trip; refresh() re-runs the server components
// so their queries re-scope to the new app.
function setCurrentAppCookie(slug: string) {
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `${CURRENT_APP_COOKIE}=${slug}; path=/; max-age=${oneYear}; samesite=lax`;
}

export function AppSwitcher({
  apps,
  currentSlug,
  canCreate,
}: {
  apps: AppDto[];
  currentSlug: string | null;
  canCreate: boolean;
}) {
  const router = useRouter();
  const current = apps.find((a) => a.slug === currentSlug) ?? apps[0] ?? null;

  function select(slug: string) {
    setCurrentAppCookie(slug);
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium transition-colors hover:bg-secondary/60 focus:outline-none focus:ring-2 focus:ring-ring">
        <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/15 text-[10px] font-bold text-primary">
          {current ? current.name.slice(0, 1).toUpperCase() : "?"}
        </span>
        <span className="max-w-[10rem] truncate">
          {current ? current.name : "No applications"}
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Applications</DropdownMenuLabel>
        {apps.map((app) => (
          <DropdownMenuItem key={app.id} onClick={() => select(app.slug)}>
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                app.status === "ACTIVE" ? "bg-success" : "bg-muted-foreground",
              )}
            />
            <span className="flex-1 truncate">{app.name}</span>
            {current?.id === app.id && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
        {apps.length === 0 && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">No applications yet</div>
        )}
        {canCreate && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/apps?new=1")}>
              <Plus className="h-4 w-4" />
              Add application
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
