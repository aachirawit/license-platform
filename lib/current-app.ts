import { cookies } from "next/headers";

import type { AppDto } from "@/lib/services/app-service";
import { CURRENT_APP_COOKIE } from "@/lib/constants";

// The selected application persists across navigation in a plain cookie (a UI
// preference, not a secret). Server components read it here to scope queries;
// every server action re-checks that the requested app actually exists.

export { CURRENT_APP_COOKIE };

/**
 * Resolve the app the dashboard is currently scoped to. Prefers the cookie's
 * slug when it matches a real app; otherwise falls back to the first app. Null
 * only when there are no apps at all.
 */
export async function resolveCurrentApp(apps: AppDto[]): Promise<AppDto | null> {
  if (apps.length === 0) return null;
  const jar = await cookies();
  const slug = jar.get(CURRENT_APP_COOKIE)?.value;
  return apps.find((a) => a.slug === slug) ?? apps[0]!;
}
