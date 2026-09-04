"use client";

// Last-resort boundary. `error.tsx` cannot catch an error thrown by the root
// layout itself, so this file replaces the entire document when that happens.
// It must render its own <html>/<body> and cannot rely on the app's styles, so
// it is intentionally self-contained and minimal.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          color: "#e5e5e5",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ textAlign: "center", padding: "1.5rem" }}>
          <h1 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>Something went wrong</h1>
          <p style={{ color: "#a3a3a3", fontSize: "0.875rem", marginBottom: "1rem" }}>
            The application failed to load.
            {error.digest ? ` Ref: ${error.digest}` : ""}
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              border: "1px solid #333",
              background: "#10b981",
              color: "#04120c",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
