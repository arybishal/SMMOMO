"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { getBrowserSupabase } from "@/lib/supabase/client";

// Real capability: Supabase's logout `scope: 'others'` revokes every other
// session's refresh tokens (this one stays signed in). Individual session
// enumeration is NOT available in this stack — no fake session rows.
export function SessionsCard() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<
    { kind: "success" } | { kind: "error"; message: string } | null
  >(null);

  async function signOutOthers() {
    setPending(true);
    setStatus(null);
    try {
      const { error } = await getBrowserSupabase().auth.signOut({
        scope: "others",
      });
      if (error) throw new Error("fail");
      setStatus({ kind: "success" });
      router.refresh();
    } catch {
      setStatus({
        kind: "error",
        message: "Could not sign out other sessions — try again.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="p-6">
      <CardTitle>Active sessions</CardTitle>
      <p className="mb-4 mt-1 text-xs text-muted-foreground">
        SMMOMO can&apos;t list individual devices — Supabase doesn&apos;t expose
        session enumeration to apps. You can still end every other session in
        one action; this device stays signed in.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={signOutOthers}
        >
          {pending ? "Signing out…" : "Sign out of all other sessions"}
        </Button>
        {status?.kind === "success" && (
          <p role="status" className="text-sm text-success-strong">
            Other sessions signed out.
          </p>
        )}
        {status?.kind === "error" && (
          <p role="alert" className="text-sm text-danger-strong">
            {status.message}
          </p>
        )}
      </div>
    </Card>
  );
}
