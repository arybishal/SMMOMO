import { getAnalyticsSummary } from "@/lib/api/analytics";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";

export default async function AnalyticsPage() {
  const stats = await getAnalyticsSummary();
  const max = Math.max(...stats.daily.map((d) => d.comments), 1);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Analytics"
        description="Comment matching and delivery performance over the last 7 days."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Comments matched" value={stats.commentsMatched} />
        <Kpi label="DMs sent" value={stats.dmsSent} />
        <Kpi label="Public replies" value={stats.publicReplies} />
        <Kpi
          label="Failed deliveries"
          value={stats.failedDeliveries}
          danger={stats.failedDeliveries > 0}
        />
      </div>

      <Card className="mt-6 p-5">
        <CardTitle>Last 7 days</CardTitle>
        {/* Pure CSS bars — no chart library until real analytics justify one.
            Series colors stay direct indigo utilities (data-viz specific). */}
        <div className="mt-6 flex h-48 items-end gap-3">
          {stats.daily.map((d) => (
            <div key={d.label} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex w-full flex-1 items-end justify-center gap-1">
                <div
                  className="w-1/2 rounded-t bg-indigo-500"
                  style={{ height: `${(d.comments / max) * 100}%` }}
                  title={`${d.comments} comments`}
                />
                <div
                  className="w-1/2 rounded-t bg-indigo-200"
                  style={{ height: `${(d.dms / max) * 100}%` }}
                  title={`${d.dms} DMs`}
                />
              </div>
              <span className="text-xs text-muted-foreground">{d.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-indigo-500" /> Comments
            matched
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-indigo-200" /> DMs sent
          </span>
        </div>
      </Card>
    </div>
  );
}

function Kpi({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <Card className="p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-2 text-2xl font-semibold tabular-nums ${
          danger ? "text-danger" : "text-foreground"
        }`}
      >
        {value.toLocaleString()}
      </p>
    </Card>
  );
}
