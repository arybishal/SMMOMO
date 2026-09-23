import Link from "next/link";
import { getInstagramAccount } from "@/lib/api/social-accounts";
import { getUsageSummary } from "@/lib/api/usage";
import { getAdminMetaConfig } from "@/lib/api/admin-meta";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import {
  IconAnalytics,
  IconArrowRight,
  IconInstagram,
  IconSettings,
} from "@/components/layout/icons";

// Hub rows carry live summaries from lib/api (same seam as every other page).
export default async function SettingsPage() {
  const [account, usage] = await Promise.all([
    getInstagramAccount(),
    getUsageSummary(),
  ]);

  // Platform-admin Integrations row only when the API grants access —
  // never a client-side isAdmin flag.
  let adminMeta: Awaited<ReturnType<typeof getAdminMetaConfig>> | null = null;
  try {
    adminMeta = await getAdminMetaConfig();
  } catch {
    adminMeta = null;
  }

  const sections = [
    {
      href: "/settings/account",
      title: "Account",
      detail: "Name, email, and password.",
      icon: IconSettings,
    },
    {
      href: "/settings/social-accounts",
      title: "Social accounts",
      detail: account
        ? `@${account.username} · ${
            account.status === "connected" ? "Connected" : "Needs attention"
          }`
        : "No Instagram account connected.",
      icon: IconInstagram,
    },
    {
      href: "/settings/usage",
      title: "Usage",
      detail: `${usage.period} · ${usage.dmsSent.toLocaleString()} DMs sent`,
      icon: IconAnalytics,
    },
    ...(adminMeta
      ? [
          {
            href: "/settings/integrations",
            title: "Integrations",
            detail: `Meta / Instagram · ${
              adminMeta.metaConfigured ? "Configured" : "Not configured"
            }`,
            icon: IconSettings,
          },
        ]
      : []),
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Settings"
        description="Manage your account and connected platforms."
      />

      <div className="space-y-3">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.href} href={s.href}>
              <Card className="flex items-center gap-4 p-4 transition-colors hover:bg-surface-muted">
                <span className="flex h-9 w-9 items-center justify-center rounded-control bg-zinc-100 text-zinc-600">
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {s.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{s.detail}</p>
                </div>
                <IconArrowRight className="h-4 w-4 text-subtle-foreground" />
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
