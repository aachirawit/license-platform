"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";

// Segment error boundary. Catches render/data errors thrown below the root
// layout and shows a recoverable fallback instead of a blank screen. The user
// never sees a stack trace or a message we did not choose - `error.digest` is a
// server-generated id that maps back to the real error in the server logs.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error({ digest: error.digest }, "client_error_boundary");
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Something went wrong</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          An unexpected error occurred. You can retry, or head back to the dashboard.
        </p>
        {error.digest && (
          <p className="pt-1 font-mono text-xs text-muted-foreground">Ref: {error.digest}</p>
        )}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => reset()}>
          Try again
        </Button>
        <Button asChild>
          <a href="/dashboard">Back to dashboard</a>
        </Button>
      </div>
    </div>
  );
}
