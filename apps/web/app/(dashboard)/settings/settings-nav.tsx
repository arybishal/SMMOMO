"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

// Settings navigation: grouped on desktop (labels above each group), a flat
// horizontally scrollable pill row on mobile. Active = current pathname.
export function SettingsNav({ showIntegrations }: { showIntegrations: boolean }) {
  const pathname = usePathname();

  const groups: NavGroup[] = [
    {
      label: "Account",
      items: [
        { href: "/settings/account", label: "Profile" },
        { href: "/settings/security", label: "Security" },
      ],
    },
    {
      label: "Workspace",
      items: [{ href: "/settings/workspace", label: "Workspace" }],
    },
    {
      label: "Connections",
      items: [{ href: "/settings/social-accounts", label: "Social accounts" }],
    },
    {
      label: "Notifications",
      items: [{ href: "/settings/notifications", label: "Notifications" }],
    },
    {
      label: "Usage",
      items: [{ href: "/settings/usage", label: "Usage" }],
    },
    ...(showIntegrations
      ? [
          {
            label: "Platform",
            items: [{ href: "/settings/integrations", label: "Integrations" }],
          },
        ]
      : []),
  ];

  return (
    <nav
      aria-label="Settings"
      className="flex shrink-0 gap-1 overflow-x-auto pb-2 md:w-52 md:flex-col md:gap-5 md:overflow-visible md:pb-0"
    >
      {groups.map((group) => (
        <div key={group.label} className="shrink-0">
          <p className="mb-1.5 hidden text-xs font-medium uppercase tracking-wide text-subtle-foreground md:block">
            {group.label}
          </p>
          <div className="flex gap-1 md:flex-col md:gap-0.5">
            {group.items.map((item) => {
              const active =
                pathname === item.href ||
                pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`whitespace-nowrap rounded-control px-3 py-1.5 text-sm font-medium transition-colors md:px-3 md:py-2
                    ${
                      active
                        ? "bg-primary-soft text-primary-strong"
                        : "text-zinc-600 hover:bg-surface-muted hover:text-foreground"
                    }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
