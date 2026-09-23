import Link from "next/link";
import { listAutomations } from "@/lib/api/automations";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { IconArrowRight } from "@/components/layout/icons";
import { AutomationList } from "./list";

export default async function AutomationsPage() {
  const automations = await listAutomations();

  const total = automations.length;
  const active = automations.filter((a) => a.status === "active").length;
  const paused = automations.filter((a) => a.status === "paused").length;
  const draft = automations.filter((a) => a.status === "draft").length;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Automations"
        description="Manage the comment-to-DM workflows running on your Instagram content."
        action={
          <Link href="/automations/new" className={buttonClasses("primary")}>
            New automation
            <IconArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      {total === 0 ? (
        <Card className="px-5 py-10 text-center">
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            No automations yet. Create one to start sending private DMs when
            followers comment your keyword.
          </p>
          <Link
            href="/automations/new"
            className={`${buttonClasses("primary")} mt-4`}
          >
            Create automation
            <IconArrowRight className="h-4 w-4" />
          </Link>
        </Card>
      ) : (
        <>
          {/* Compact summary — derived from the list, not hard-coded */}
          <Card className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-3.5 text-sm">
            <span className="font-semibold text-foreground">{total} total</span>
            <span>
              <span className="font-semibold text-success">{active}</span>{" "}
              <span className="text-muted-foreground">active</span>
            </span>
            <span>
              <span className="font-semibold text-warning-strong">{paused}</span>{" "}
              <span className="text-muted-foreground">paused</span>
            </span>
            <span>
              <span className="font-semibold text-neutral-strong">{draft}</span>{" "}
              <span className="text-muted-foreground">draft</span>
            </span>
          </Card>

          <AutomationList automations={automations} />
        </>
      )}
    </div>
  );
}
