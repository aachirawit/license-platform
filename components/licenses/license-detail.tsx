"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LicenseStatusBadge } from "./status-badge";
import { LicenseActions, type LicensePermissions } from "./license-actions";
import { formatDateTime, maskedKey, relativeTime } from "@/lib/format";
import type { ProviderLicense } from "@/lib/license/types";

export interface TimelineEntry {
  action: string;
  at: string;
  by: string | null;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2.5 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

const ACTION_LABEL: Record<string, string> = {
  LICENSE_GENERATED: "Generated",
  LICENSE_BANNED: "Banned",
  LICENSE_UNBANNED: "Unbanned",
  LICENSE_REVOKED: "Revoked",
  LICENSE_EXTENDED: "Extended",
  HWID_RESET: "HWID reset",
};

export function LicenseDetail({
  license,
  appName,
  appSlug,
  packageName,
  timeline,
  perms,
}: {
  license: ProviderLicense;
  appName: string;
  appSlug: string;
  packageName: string | null;
  timeline: TimelineEntry[];
  perms: LicensePermissions;
}) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/licenses">
            <Button size="icon" variant="ghost" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-lg font-semibold">{maskedKey(license.keyPrefix)}</span>
              <LicenseStatusBadge status={license.status} />
            </div>
            <div className="text-sm text-muted-foreground">
              <Link href="/apps" className="hover:text-foreground">
                {appName}
              </Link>{" "}
              · {appSlug}
            </div>
          </div>
        </div>
        <LicenseActions license={license} perms={perms} onChanged={() => router.refresh()} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Field label="Application" value={appName} />
            <Field label="Package" value={packageName ?? "—"} />
            <Field label="Status" value={<LicenseStatusBadge status={license.status} />} />
            <Field label="Provider" value={license.provider} />
            <Field
              label="Provider license ID"
              value={<span className="font-mono text-xs">{license.providerLicenseId ?? "—"}</span>}
            />
            <Field label="Created" value={formatDateTime(license.createdAt)} />
            <Field label="Activated" value={formatDateTime(license.activatedAt)} />
            <Field
              label="Expires"
              value={license.expiresAt ? formatDateTime(license.expiresAt) : "Lifetime"}
            />
            <Field label="Last used" value={relativeTime(license.lastUsedAt)} />
            <Field label="HWID" value={license.hwidBound ? "Bound to a machine" : "Not bound"} />
            <Field label="HWID resets" value={<span className="tabular-nums">{license.hwidResetCount}</span>} />
            {license.note && <Field label="Note" value={license.note} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recorded activity.</p>
            ) : (
              <ol className="relative space-y-4 border-l border-border pl-4">
                {timeline.map((entry, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-primary" />
                    <div className="text-sm font-medium">
                      {ACTION_LABEL[entry.action] ?? entry.action}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDateTime(entry.at)}
                      {entry.by ? ` · ${entry.by}` : ""}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
