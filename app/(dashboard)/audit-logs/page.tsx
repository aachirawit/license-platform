import { requirePermission } from "@/lib/auth/context";
import { PageHeader } from "@/components/layout/page-header";
import { AuditView } from "@/components/audit/audit-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AuditLogsPage() {
  await requirePermission("audit.read");
  return (
    <div>
      <PageHeader
        title="Audit Logs"
        description="Every sensitive admin action, append-only. Newest first."
      />
      <div className="p-6">
        <AuditView />
      </div>
    </div>
  );
}
