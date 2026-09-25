import type { ReactNode } from "react";
import { getAdminMetaConfig } from "@/lib/api/admin-meta";
import { SettingsNav } from "./settings-nav";

// Settings shell: nav (left on desktop, scrollable pill row on mobile) +
// page content. Integrations entry only renders when the API grants
// platform-admin access (same server-side check the hub page used).
export default async function SettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  let showIntegrations = false;
  try {
    await getAdminMetaConfig();
    showIntegrations = true;
  } catch {
    showIntegrations = false;
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-col gap-4 md:flex-row md:gap-10">
        <SettingsNav showIntegrations={showIntegrations} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
