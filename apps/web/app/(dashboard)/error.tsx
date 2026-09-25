"use client";

import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

// Route-group error boundary (Task 024 §24): a failed dashboard page render
// must not strand the user — reset in place, or leave for the dashboard.
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-lg font-semibold text-foreground">
        Something went wrong
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This page could not load. Try again — if it keeps failing, reload the
        app or sign out and back in.
      </p>
      <div className="mt-5 flex justify-center gap-3">
        <button type="button" className={buttonClasses("primary")} onClick={reset}>
          Try again
        </button>
        <Link href="/dashboard" className={buttonClasses("secondary")}>
          Back to dashboard
        </Link>
      </div>
      {error.digest && (
        <p className="mt-4 text-xs text-subtle-foreground">
          Reference: {error.digest}
        </p>
      )}
    </div>
  );
}
