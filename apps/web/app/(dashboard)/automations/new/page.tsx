import { notFound } from "next/navigation";
import { listPosts } from "@/lib/api/posts";
import { getAutomation } from "@/lib/api/automations";
import { PageHeader } from "@/components/layout/page-header";
import { AutomationBuilder } from "./builder";

// `?edit=<id>` prefills the builder (Edit action on the detail page).
// `?post=<id>` preselects the post for a new automation (Create automation
// action on the Posts page) — same query-param prefill mechanism; an unknown
// post id is ignored (renders New with an empty selector), while an unknown
// `edit` id 404s. When both are present, the edited automation's own post wins.
// searchParams is a Promise in Next 16 — await it (see node_modules/next/dist/docs).
export default async function AutomationBuilderPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; post?: string }>;
}) {
  const { edit, post } = await searchParams;

  const [posts, automation] = await Promise.all([
    listPosts(),
    edit ? getAutomation(edit) : Promise.resolve(undefined),
  ]);

  // Empty/unknown `edit` handling: empty string falls through to New; an
  // unknown non-empty id 404s (same as the detail page).
  if (edit && !automation) {
    notFound();
  }

  const initialPostId =
    !automation && post && posts.some((p) => p.id === post)
      ? post
      : undefined;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={automation ? "Edit automation" : "New automation"}
        description={
          automation
            ? `Editing “${automation.name}” — update the trigger and messages.`
            : "Define what happens when someone comments on your post."
        }
      />
      <AutomationBuilder
        posts={posts}
        initial={automation}
        initialPostId={initialPostId}
      />
    </div>
  );
}
