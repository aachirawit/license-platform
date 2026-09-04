// Client-safe constants (no server-only imports), so both client components and
// server modules can share them without pulling next/headers into the browser
// bundle.

/** Cookie holding the dashboard's currently selected app slug (a UI preference). */
export const CURRENT_APP_COOKIE = "lp_app";
