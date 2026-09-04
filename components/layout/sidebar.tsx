"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  KeyRound,
  LayoutDashboard,
  ScrollText,
  Settings,
  Shield,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { Permission } from "@/lib/auth/rbac";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  // The permission required to see this item; the server already gates the
  // pages, this just hides links the current role cannot use.
  permission: Permission;
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "app.read" },
  { href: "/apps", label: "Apps", icon: Boxes, permission: "app.read" },
  { href: "/licenses", label: "Licenses", icon: KeyRound, permission: "license.read" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, permission: "analytics.read" },
  { href: "/security", label: "Security", icon: Shield, permission: "security.read" },
  { href: "/audit-logs", label: "Audit Logs", icon: ScrollText, permission: "audit.read" },
  { href: "/admins", label: "Admins", icon: Users, permission: "admin.read" },
  { href: "/settings", label: "Settings", icon: Settings, permission: "settings.read" },
];

export function Sidebar({ permissions }: { permissions: Permission[] }) {
  const pathname = usePathname();
  const allowed = NAV.filter((item) => permissions.includes(item.permission));

  return (
    <nav className="flex flex-col gap-1 p-3">
      {allowed.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
