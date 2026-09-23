"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  IconAnalytics,
  IconAutomation,
  IconInbox,
  IconPosts,
  IconSettings,
  IconDashboard,
  IconClose,
} from "./icons";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: IconDashboard },
  { href: "/automations", label: "Automations", icon: IconAutomation },
  { href: "/posts", label: "Posts", icon: IconPosts },
  { href: "/inbox", label: "Inbox", icon: IconInbox },
  { href: "/analytics", label: "Analytics", icon: IconAnalytics },
  { href: "/settings", label: "Settings", icon: IconSettings },
];

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  // Close the mobile drawer after navigating.
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <>
      {/* Mobile backdrop — overlay scrim, intentionally outside the color system */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-zinc-950/40 md:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-surface
          transition-transform md:translate-x-0
          ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-control bg-primary text-xs font-bold text-primary-foreground">
              S
            </span>
            <span className="text-sm font-semibold tracking-tight text-foreground">
              SMMOMO
            </span>
          </Link>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground md:hidden"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <IconClose />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-control px-3 py-2 text-sm font-medium transition-colors
                  ${
                    active
                      ? "bg-primary-soft text-primary-strong"
                      : "text-zinc-600 hover:bg-surface-muted hover:text-foreground"
                  }`}
              >
                <Icon className="h-4.5 w-4.5 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border px-5 py-4">
          <p className="text-xs text-subtle-foreground">V1 — Instagram only</p>
        </div>
      </aside>
    </>
  );
}
