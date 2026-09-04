import { Badge } from "@/components/ui/badge";
import type { LicenseStatus } from "@/lib/license/types";

// Status carries meaning in color AND word, so it survives a screenshot and a
// colorblind reader.
const MAP: Record<LicenseStatus, { variant: "success" | "warning" | "danger" | "muted"; label: string }> = {
  ACTIVE: { variant: "success", label: "Active" },
  UNUSED: { variant: "muted", label: "Unused" },
  EXPIRED: { variant: "warning", label: "Expired" },
  BANNED: { variant: "danger", label: "Banned" },
  REVOKED: { variant: "danger", label: "Revoked" },
};

export function LicenseStatusBadge({ status }: { status: LicenseStatus }) {
  const { variant, label } = MAP[status];
  return <Badge variant={variant}>{label}</Badge>;
}
