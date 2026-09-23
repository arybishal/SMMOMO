"use client";

import { IconMenu } from "./icons";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-zinc-200 bg-white/90 px-4 backdrop-blur sm:px-6">
      <button
        type="button"
        className="text-zinc-600 hover:text-zinc-900 md:hidden"
        onClick={onMenu}
        aria-label="Open navigation"
      >
        <IconMenu />
      </button>

      <div className="flex-1" />

      {/* Connection pill — static until real auth/social accounts land. */}
      <span className="hidden items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20 sm:inline-flex">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Instagram connected
      </span>

      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">
        BA
      </div>
    </header>
  );
}
