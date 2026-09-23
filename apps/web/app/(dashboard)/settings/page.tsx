import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { IconArrowRight, IconInstagram, IconSettings } from "@/components/layout/icons";

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
    detail: "Connected Instagram accounts.",
    icon: IconInstagram,
  },
  {
    href: "/settings/usage",
    title: "Usage",
    detail: "DMs, comments, and replies this period.",
    icon: IconArrowRight,
  },
];

export default function SettingsPage() {
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
              <Card className="flex items-center gap-4 p-4 transition-colors hover:bg-zinc-50">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-zinc-100 text-zinc-600">
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-900">{s.title}</p>
                  <p className="text-xs text-zinc-500">{s.detail}</p>
                </div>
                <IconArrowRight className="h-4 w-4 text-zinc-400" />
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
