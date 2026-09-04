import { Bell, Boxes, Shield, SlidersHorizontal } from "lucide-react";

import { requirePermission } from "@/lib/auth/context";
import { listApps } from "@/lib/services/app-service";
import { SESSION_TTL_MS } from "@/lib/auth/session";
import { RULES } from "@/lib/http/rate-limit";
import { isActivationSigningEnabled } from "@/lib/security/activation-signing";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Settings surfaces the platform's live configuration. Values that come from
// the environment (Discord, retention, provider) are shown here read-only -
// they are set server-side, never edited from the browser, and no secret is
// ever displayed. Editable persisted settings can be added later behind a
// Settings table without changing this page's shape.
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2.5 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

export default async function SettingsPage() {
  await requirePermission("settings.read");
  const apps = await listApps();

  const discordConfigured = Boolean(process.env.DISCORD_WEBHOOK_URL);
  const retention = {
    telemetry: process.env.TELEMETRY_RETENTION_DAYS ?? "90",
    security: process.env.SECURITY_EVENT_RETENTION_DAYS ?? "180",
    audit: process.env.AUDIT_LOG_RETENTION_DAYS ?? "365",
  };

  return (
    <div>
      <PageHeader title="Settings" description="Platform configuration. Secrets are never shown." />

      <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
              General
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Row label="Platform" value="License Platform" />
            <Row label="Applications" value={<span className="tabular-nums">{apps.length}</span>} />
            <Row label="Environment" value={process.env.NODE_ENV ?? "development"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Security
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Row label="Session duration" value={`${Math.round(SESSION_TTL_MS / 86_400_000)} days`} />
            <Row
              label="Login rate limit"
              value={`${RULES.login.limit} / ${Math.round(RULES.login.windowMs / 60_000)} min`}
            />
            <Row label="Session revocation" value="Server-side (instant)" />
            <Row
              label="Activation response signing"
              value={
                isActivationSigningEnabled() ? (
                  <Badge variant="success">Ed25519</Badge>
                ) : (
                  <Badge variant="muted">TLS only</Badge>
                )
              }
            />
            <Row label="Audit retention" value={`${retention.audit} days`} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Boxes className="h-4 w-4 text-primary" />
              Providers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {apps.length === 0 ? (
              <p className="text-sm text-muted-foreground">No applications yet.</p>
            ) : (
              apps.map((a) => (
                <Row
                  key={a.id}
                  label={a.name}
                  value={
                    <Badge variant={a.provider === "MOCK" ? "muted" : "default"}>
                      {a.provider === "MOCK" ? "Mock Provider" : "KeyAuth"}
                    </Badge>
                  }
                />
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Row
              label="Discord alerts"
              value={
                discordConfigured ? (
                  <Badge variant="success">Configured</Badge>
                ) : (
                  <Badge variant="muted">Not configured</Badge>
                )
              }
            />
            <Row label="Retention · security" value={`${retention.security} days`} />
            <Row label="Retention · telemetry" value={`${retention.telemetry} days`} />
            <p className="pt-3 text-xs text-muted-foreground">
              Set DISCORD_WEBHOOK_URL server-side to enable alerts. The URL is never exposed to the
              browser.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
