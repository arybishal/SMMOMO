"use client";

import { useState } from "react";

// Copy-to-clipboard for the account id. Feedback via aria-live text.
export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (permissions/insecure context) — no-op.
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <code className="rounded bg-surface-muted px-1.5 py-0.5 text-xs text-zinc-600">
        {value}
      </code>
      <button
        type="button"
        onClick={copy}
        className="text-xs font-medium text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        aria-label="Copy account ID"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
      <span role="status" className="sr-only">
        {copied ? "Account ID copied to clipboard" : ""}
      </span>
    </span>
  );
}
