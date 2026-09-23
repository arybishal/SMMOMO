import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { AccountForm } from "./account-form";

// Real signed-in user via cookie session (proxy already guards this route;
// the redirect here is belt-and-suspenders for direct RSC requests).
export default async function AccountSettingsPage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const initialName =
    (user.user_metadata?.name as string | undefined)?.trim() || "";

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Account" description="Your profile details." />
      <AccountForm email={user.email ?? ""} initialName={initialName} />
    </div>
  );
}
