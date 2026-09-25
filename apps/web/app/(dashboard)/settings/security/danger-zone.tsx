"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getBrowserSupabase } from "@/lib/supabase/client";

// Sign out is real (current session). Account deletion has NO backend in
// this architecture — shown as a clearly labeled coming-soon row, never a
// dead button.
export function DangerZone() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      await getBrowserSupabase().auth.signOut({ scope: "local" });
    } catch {
      // Even on failure the local cookie is cleared below — the session
      // becomes unusable for this device regardless.
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <Card className="border-danger/30 p-6">
      <CardTitle>Danger Zone</CardTitle>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Sign out</p>
          <p className="text-xs text-muted-foreground">
            End your session on this device.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={signOut}
        >
          {pending ? "Signing out…" : "Sign out"}
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Delete account</p>
          <p className="text-xs text-muted-foreground">
            Permanently delete your SMMOMO account and associated data.
          </p>
        </div>
        <Badge tone="neutral">Coming soon</Badge>
      </div>
    </Card>
  );
}
