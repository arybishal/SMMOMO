import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/api/workspace";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AvatarSection } from "./avatar-section";
import { ProfileForm } from "./profile-form";
import { EmailSection } from "./email-section";

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export default async function ProfileSettingsPage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const name = str(meta.name);
  const avatarUrl = str(meta.avatar_url);
  const country = str(meta.country);
  const timezone = str(meta.timezone);
  const phoneCc = str(meta.phone_cc);
  const phoneNumber = str(meta.phone_number);
  const email = user.email ?? "";
  const newEmail = str(
    (user as { new_email?: unknown }).new_email,
  );

  let workspace: Awaited<ReturnType<typeof getWorkspace>> | undefined;
  try {
    workspace = await getWorkspace();
  } catch {
    workspace = undefined;
  }

  const fields = [
    { label: "profile picture", done: avatarUrl !== "" },
    { label: "full name", done: name !== "" },
    { label: "email", done: email !== "" },
    { label: "phone number", done: phoneCc !== "" && phoneNumber !== "" },
    { label: "country", done: country !== "" },
    { label: "timezone", done: timezone !== "" },
  ];
  const doneCount = fields.filter((f) => f.done).length;
  const pct = Math.round((doneCount / fields.length) * 100);
  const missing = fields.filter((f) => !f.done).map((f) => f.label);

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Profile"
        description="Manage your personal information and how your account appears across SMMOMO."
      />

      <div className="space-y-6">
        <Card className="p-6">
          <div className="flex items-center gap-5">
            <AvatarSection url={avatarUrl} name={name} email={email} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-base font-semibold text-foreground">
                  {name || email}
                </p>
                {workspace?.role && (
                  <Badge tone="info">
                    {workspace.role === "owner"
                      ? "Owner"
                      : workspace.role === "admin"
                        ? "Admin"
                        : "Member"}
                  </Badge>
                )}
              </div>
              <p className="truncate text-sm text-muted-foreground">{email}</p>
              <div className="mt-2 space-y-0.5">
                <p className="text-xs font-medium text-foreground">
                  {pct}% profile complete
                </p>
                {missing.length > 0 && (
                  <p className="text-xs text-subtle-foreground">
                    Complete your profile — add your{" "}
                    {missing.join(", ")}.
                  </p>
                )}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <CardTitle>Personal information</CardTitle>
          <p className="mb-4 mt-1 text-xs text-muted-foreground">
            Used across SMMOMO — your name on the account, and country and
            timezone for scheduling and display.
          </p>
          <ProfileForm
            name={name}
            country={country}
            timezone={timezone}
            phoneCc={phoneCc}
            phoneNumber={phoneNumber}
          />
        </Card>

        <EmailSection email={email} newEmail={newEmail} />
      </div>
    </div>
  );
}
