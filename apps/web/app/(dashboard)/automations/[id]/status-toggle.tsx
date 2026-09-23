"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClasses } from "@/components/ui/button";
import { updateAutomation } from "@/lib/api/automations";
import type { Automation } from "@/types";

// Pause / Activate on the detail page — PATCHes status through the API seam,
// then router.refresh() so the server page re-renders with the new row.
export function StatusToggle({
  id,
  status,
}: {
  id: string;
  status: Automation["status"];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next: Automation["status"] = status === "active" ? "paused" : "active";

  async function toggle() {
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      await updateAutomation(id, { status: next });
      router.refresh();
    } catch {
      setError("Could not update status — try again.");
      setPending(false);
    }
  }

  return (
    <span className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        className={buttonClasses("secondary")}
        onClick={toggle}
        disabled={pending}
      >
        {pending ? "Saving…" : status === "active" ? "Pause" : "Activate"}
      </button>
      {error && (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      )}
    </span>
  );
}
