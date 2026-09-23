import { getUsageSummary } from "@/lib/api/usage";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";

export default async function UsageSettingsPage() {
  const usage = await getUsageSummary();

  const rows = [
    { label: "DMs sent", value: usage.dmsSent },
    { label: "Comments processed", value: usage.commentsProcessed },
    { label: "Public replies", value: usage.publicReplies },
    { label: "Failed deliveries", value: usage.failedDeliveries },
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Usage"
        description={`Activity for ${usage.period}. SMMOMO is free during launch testing.`}
      />

      <Card>
        <div className="border-b border-zinc-100 px-5 py-4">
          <CardTitle>This period</CardTitle>
        </div>
        <ul className="divide-y divide-zinc-100">
          {rows.map((r) => (
            <li
              key={r.label}
              className="flex items-center justify-between px-5 py-3.5 text-sm"
            >
              <span className="text-zinc-600">{r.label}</span>
              <span
                className={`font-medium tabular-nums ${
                  r.label === "Failed deliveries" && r.value > 0
                    ? "text-red-600"
                    : "text-zinc-900"
                }`}
              >
                {r.value.toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <p className="mt-4 text-xs text-zinc-400">
        Usage feeds future billing. No payment integration in V1.
      </p>
    </div>
  );
}
