import { redirect } from "next/navigation";
import { getAdminMetaConfig } from "@/lib/api/admin-meta";
import { PageHeader } from "@/components/layout/page-header";
import { MetaForm } from "./meta-form";

// Platform-admin only. Non-admins get 403 from the API → bounce to settings
// hub (no credential fields ever render for them).
export default async function IntegrationsSettingsPage() {
  let config;
  try {
    config = await getAdminMetaConfig();
  } catch {
    redirect("/settings");
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Integrations"
        description="Platform-level Meta / Instagram app credentials (admin only)."
      />
      <MetaForm initial={config} />
    </div>
  );
}
