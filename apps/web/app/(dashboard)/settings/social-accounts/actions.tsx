"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, buttonClasses } from "@/components/ui/button";
import {
  disconnectInstagram,
  instagramConnectHref,
} from "@/lib/api/social-accounts";

// Fires after connect/disconnect so the topbar pill re-reads connection state
// without a full page load.
export const CONNECTION_CHANGED_EVENT = "smmomo:connection-changed";

// Connect is a plain navigation to the API → Instagram (cookie rides along).
export function ConnectInstagram() {
  return (
    <a href={instagramConnectHref()} className={buttonClasses("primary")}>
      Connect
    </a>
  );
}

// Disconnect: DELETE via the seam, then refresh server pages + notify topbar.
export function DisconnectInstagram({ username }: { username: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setPending(true);
    setError(null);
    try {
      await disconnectInstagram();
      window.dispatchEvent(new Event(CONNECTION_CHANGED_EVENT));
      router.refresh();
    } catch {
      setError("Disconnect failed — try again.");
      setPending(false);
    }
  }

  return (
    <div>
      <Button variant="secondary" onClick={onClick} disabled={pending}>
        {pending ? "Disconnecting…" : `Disconnect ${username}`}
      </Button>
      {error && (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
