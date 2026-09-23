"use client";

import { IconMenu } from "./icons";

export function Topbar({ onMenu }: { onMenu: () => void }) {
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
          Static until real auth/social accounts land. */}
      <span className="hidden items-center gap-2 rounded-pill bg-success-soft px-3 py-1 text-xs font-medium text-success-strong ring-1 ring-inset ring-success/20 sm:inline-flex">
        <span className="h-1.5 w-1.5 rounded-pill bg-success" />
        Instagram connected
      </span>

      <div className="flex h-8 w-8 items-center justify-center rounded-pill bg-foreground text-xs font-semibold text-background">
        BA
      </div>
    </header>
  );
}
