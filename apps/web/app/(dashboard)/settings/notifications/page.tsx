import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// No notification backend exists (no email/notification infrastructure in
// this stack) — an honest placeholder, never switches that persist nowhere.
export default function NotificationsSettingsPage() {
  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Notifications"
        description="Choose what SMMOMO notifies you about."
      />
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              Notification preferences
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Email and in-app notification choices will live here once
              notification delivery ships. Nothing is configurable yet.
            </p>
          </div>
          <Badge tone="neutral">Coming soon</Badge>
        </div>
      </Card>
    </div>
  );
}
