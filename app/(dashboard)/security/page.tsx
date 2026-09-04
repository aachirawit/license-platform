import { requirePermission } from "@/lib/auth/context";
import { PageHeader } from "@/components/layout/page-header";
import { SecurityView } from "@/components/security/security-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  await requirePermission("security.read");
  return (
    <div>
      <PageHeader
        title="Security"
        description="Login failures, HWID mismatches, banned-key attempts and other suspicious activity."
      />
      <div className="p-6">
        <SecurityView />
      </div>
    </div>
  );
}
