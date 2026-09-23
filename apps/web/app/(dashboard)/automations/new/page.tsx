import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Static preview of the builder concept. The interactive builder is Task 006 —
// this page exists so the route is real and explainable, not an empty shell.
export default function NewAutomationPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="New automation"
        description="Define what happens when someone comments on your post."
      />

      <div className="space-y-4">
        <Step
          number="1"
          label="WHEN"
          title="Instagram comment"
          detail="Choose a post or reel to watch."
          badge="Instagram comment"
        />
        <Step
          number="2"
          label="IF"
          title="Comment contains a keyword"
          detail='e.g. the comment includes "LINK"'
          badge="Keyword match"
        />
        <Step
          number="3"
          label="THEN"
          title="Send a private DM"
          detail={`e.g. "Hey {{first_name}}, here's the link…"`}
          badge="Private reply"
          badgeTone="info"
        />
        <Step
          number="4"
          label="OPTIONALLY"
          title="Public reply"
          detail='e.g. "Sent! Check your DMs."'
          badge="Public reply"
          badgeTone="draft"
        />
      </div>

      <Card className="mt-6 p-5">
        <p className="text-sm text-zinc-600">
          The full interactive builder — post picker, keyword editor, message
          composer with <code className="text-xs">{"{{first_name}}"}</code>{" "}
          variables, and activation — arrives with{" "}
          <span className="font-medium text-zinc-900">Task 006</span>.
        </p>
      </Card>
    </div>
  );
}

function Step({
  number,
  label,
  title,
  detail,
  badge,
  badgeTone = "neutral",
}: {
  number: string;
  label: string;
  title: string;
  detail: string;
  badge: string;
  badgeTone?: "neutral" | "info" | "draft";
}) {
  return (
    <Card className="flex items-start gap-4 p-5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">
        {number}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          {label}
        </p>
        <p className="mt-0.5 font-medium text-zinc-900">{title}</p>
        <p className="mt-0.5 text-sm text-zinc-500">{detail}</p>
      </div>
      <Badge tone={badgeTone}>{badge}</Badge>
    </Card>
  );
}
