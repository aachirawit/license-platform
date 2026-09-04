// Human labels for audit action codes, shared by the dashboard recent-activity
// list, the audit-logs page and the licence timeline.
export const ACTION_LABELS: Record<string, string> = {
  ADMIN_LOGIN: "signed in",
  ADMIN_LOGOUT: "signed out",
  APP_CREATED: "created an app",
  APP_UPDATED: "updated an app",
  APP_DELETED: "deleted an app",
  PACKAGE_CREATED: "created a package",
  PACKAGE_UPDATED: "updated a package",
  PACKAGE_DELETED: "deleted a package",
  LICENSE_GENERATED: "generated licenses",
  LICENSE_BANNED: "banned a license",
  LICENSE_UNBANNED: "unbanned a license",
  LICENSE_REVOKED: "revoked a license",
  LICENSE_EXTENDED: "extended a license",
  HWID_RESET: "reset a HWID",
  ADMIN_CREATED: "created an admin",
  ADMIN_UPDATED: "updated an admin",
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.toLowerCase().replace(/_/g, " ");
}
