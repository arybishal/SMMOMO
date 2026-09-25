"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClasses } from "@/components/ui/button";
import { syncPosts } from "@/lib/api/posts";

// Task 024: real content import — POST → Graph /media → posts upsert, then
// router.refresh() so the server page re-renders with the imported rows.
export function SyncPosts() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      await syncPosts();
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Could not import posts — try again.",
      );
      setPending(false);
    }
  }

  return (
    <span className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        className={buttonClasses("secondary")}
        onClick={onClick}
        disabled={pending}
      >
        {pending ? "Importing…" : "Sync posts"}
      </button>
      {error && (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      )}
    </span>
  );
}
