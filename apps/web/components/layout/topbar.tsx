"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconMenu } from "./icons";
import { getBrowserSupabase } from "@/lib/supabase/client";

function initialsOf(name: string | null, email: string | null): string {
  const source = (name ?? email ?? "").trim();
  if (!source) return "";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setName(((user?.user_metadata?.name as string | undefined) ?? null));
      setEmail(user?.email ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      setName(((user?.user_metadata?.name as string | undefined) ?? null));
      setEmail(user?.email ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    await getBrowserSupabase().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initials = initialsOf(name, email);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur sm:px-6">
      <button
        type="button"
        className="text-zinc-600 hover:text-foreground md:hidden"
        onClick={onMenu}
        aria-label="Open navigation"
      >
        <IconMenu />
      </button>

      <div className="flex-1" />

      {/* Connection pill — same semantic construction as Badge tone="success".
          Static until Meta OAuth (Task 015). */}
      <span className="hidden items-center gap-2 rounded-pill bg-success-soft px-3 py-1 text-xs font-medium text-success-strong ring-1 ring-inset ring-success/20 sm:inline-flex">
        <span className="h-1.5 w-1.5 rounded-pill bg-success" />
        Instagram connected
      </span>

      {initials && (
        <span
          className="flex h-8 w-8 items-center justify-center rounded-pill bg-foreground text-xs font-semibold text-background"
          title={email ?? undefined}
        >
          {initials}
        </span>
      )}

      <button
        type="button"
        onClick={signOut}
        className="rounded-control px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        Sign out
      </button>
    </header>
  );
}
