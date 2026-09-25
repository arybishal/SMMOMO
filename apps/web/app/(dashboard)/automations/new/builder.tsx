"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { createAutomation, updateAutomation } from "@/lib/api/automations";
import type { Automation, Post } from "@/types";

type Field = "post" | "keyword" | "dm" | "reply";

const SAMPLE_FIRST_NAME = "Sarah";

// Client-side preview only — no backend, no chart/preview engine (Task 006 spec).
function renderAsFollower(text: string): string {
  return text.replace(/\{\{first_name\}\}/g, SAMPLE_FIRST_NAME);
}

function FieldError({
  id,
  show,
  children,
}: {
  id: string;
  show: boolean;
  children: string;
}) {
  if (!show) return null;
  return (
    <p id={`${id}-error`} className="mt-1 text-xs text-danger">
      {children}
    </p>
  );
}

const sectionLabel =
  "text-xs font-semibold uppercase tracking-wide text-subtle-foreground";

// One client island: form state, validation, and live preview.
// Data (posts, optional automation to edit, optional post to preselect from
// the Posts page's Create automation action) arrives as props from the
// server page. An edit prefill always wins over the post hint.
export function AutomationBuilder({
  posts,
  initial,
  initialPostId,
}: {
  posts: Post[];
  initial?: Automation;
  initialPostId?: string;
}) {
  const router = useRouter();
  const [postId, setPostId] = useState(initial?.postId ?? initialPostId ?? "");
  const [keyword, setKeyword] = useState(initial?.keyword ?? "");
  const [dm, setDm] = useState(initial?.privateReply ?? "");
  const [replyOn, setReplyOn] = useState(initial?.publicReply != null);
  const [reply, setReply] = useState(initial?.publicReply ?? "");
  // New automations default to activating right after create (Task 024) —
  // the server re-validates connection/duplicates before status becomes active.
  const [activate, setActivate] = useState(!initial);
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const invalid: Record<Field, boolean> = {
    post: postId === "",
    keyword: keyword.trim() === "",
    dm: dm.trim() === "",
    reply: replyOn && reply.trim() === "",
  };
  const isValid =
    !invalid.post && !invalid.keyword && !invalid.dm && !invalid.reply;

  function touch(field: Field) {
    setTouched((t) => ({ ...t, [field]: true }));
  }

  const show = (field: Field) => Boolean(touched[field] && invalid[field]);
  const selectedPost = posts.find((p) => p.id === postId);
  const usesVariable =
    /\{\{first_name\}\}/.test(dm) || (replyOn && /\{\{first_name\}\}/.test(reply));

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <form
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          if (!isValid || pending) return;
          setError(null);
          setPending(true);
          try {
            const input = {
              postId,
              keyword: keyword.trim(),
              privateReply: dm.trim(),
              publicReply: replyOn ? reply.trim() : null,
              // No separate name field in this builder — the keyword is the
              // user-facing label until a dedicated field exists.
              name: keyword.trim(),
              ...(initial ? {} : { activate }),
            };
            const saved = initial
              ? await updateAutomation(initial.id, input)
              : await createAutomation(input);
            router.push(`/automations/${saved.id}`);
            router.refresh();
          } catch (err) {
            // API validation messages (activation gate, duplicate keyword…)
            // surface verbatim; network failures get the friendly fallback.
            setError(
              err instanceof Error && err.message
                ? err.message
                : "Could not save — check your connection and try again.",
            );
            setPending(false);
          }
        }}
        className="space-y-4"
      >
        <Card className="p-6">
          <h2 className="text-sm font-semibold text-foreground">Setup</h2>

          <div className="mt-5 space-y-6">
            {error && (
              <p
                role="alert"
                className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger-strong"
              >
                {error}
              </p>
            )}
            {/* WHEN — post selector */}
            <div className="space-y-1.5">
              <p className={sectionLabel}>When — Instagram comment</p>
              <Label htmlFor="post">Post or reel to watch</Label>
              <Select
                id="post"
                name="post"
                required
                value={postId}
                onChange={(e) => setPostId(e.target.value)}
                onBlur={() => touch("post")}
                aria-invalid={show("post") || undefined}
                aria-describedby={show("post") ? "post-error" : undefined}
              >
                <option value="">
                  {posts.length === 0
                    ? "No posts available"
                    : "Select a post or reel…"}
                </option>
                {posts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.type} · {p.caption}
                  </option>
                ))}
              </Select>
              <FieldError id="post" show={show("post")}>
                Choose a post or reel to watch.
              </FieldError>
              {posts.length === 0 && (
                <p className="text-xs text-subtle-foreground">
                  No posts yet —{" "}
                  <Link href="/posts" className="font-medium text-primary hover:text-primary-hover">
                    import your posts
                  </Link>{" "}
                  first, then come back here.
                </p>
              )}
            </div>

            {/* IF — keyword */}
            <div className="space-y-1.5">
              <p className={sectionLabel}>If — Comment contains a keyword</p>
              <Label htmlFor="keyword">Trigger keyword</Label>
              <Input
                id="keyword"
                name="keyword"
                required
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onBlur={() => touch("keyword")}
                placeholder="e.g. CHECK"
                aria-invalid={show("keyword") || undefined}
                aria-describedby={
                  show("keyword") ? "keyword-error" : undefined
                }
              />
              <FieldError id="keyword" show={show("keyword")}>
                Enter a trigger keyword — a comment must contain it to fire.
              </FieldError>
            </div>

            {/* THEN — private DM */}
            <div className="space-y-1.5">
              <p className={sectionLabel}>Then — Send a private DM</p>
              <Label htmlFor="dm">Direct message</Label>
              <Textarea
                id="dm"
                name="dm"
                rows={4}
                required
                value={dm}
                onChange={(e) => setDm(e.target.value)}
                onBlur={() => touch("dm")}
                placeholder={`Hey {{first_name}}, here's your link…`}
                aria-invalid={show("dm") || undefined}
                aria-describedby={show("dm") ? "dm-error" : "dm-hint"}
              />
              <p id="dm-hint" className="text-xs text-subtle-foreground">
                Available:{" "}
                <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-700">
                  {"{{first_name}}"}
                </code>
              </p>
              <FieldError id="dm" show={show("dm")}>
                Write the private DM followers will receive.
              </FieldError>
            </div>

            {/* OPTIONALLY — public reply */}
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <input
                  id="replyOn"
                  name="replyOn"
                  type="checkbox"
                  checked={replyOn}
                  onChange={(e) => setReplyOn(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                <Label htmlFor="replyOn" className="text-foreground">
                  Optionally — Send a public reply too
                </Label>
              </div>

              {replyOn && (
                <div className="space-y-1.5">
                  <Label htmlFor="reply">Public reply</Label>
                  <Textarea
                    id="reply"
                    name="reply"
                    rows={2}
                    required
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onBlur={() => touch("reply")}
                    placeholder="Sent! Check your DMs."
                    aria-invalid={show("reply") || undefined}
                    aria-describedby={show("reply") ? "reply-error" : undefined}
                  />
                  <FieldError id="reply" show={show("reply")}>
                    Write the public reply, or turn the toggle off.
                  </FieldError>
                </div>
              )}
            </div>
          </div>
        </Card>

        {!initial && (
          <div className="flex items-center gap-2.5">
            <input
              id="activateNow"
              name="activateNow"
              type="checkbox"
              checked={activate}
              onChange={(e) => setActivate(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            <Label htmlFor="activateNow" className="text-foreground">
              Activate right after saving
            </Label>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={!isValid || pending}>
            {pending
              ? "Saving…"
              : initial
                ? "Save changes"
                : activate
                  ? "Create & activate"
                  : "Save as draft"}
          </Button>
          <Link
            href={initial ? `/automations/${initial.id}` : "/automations"}
            className={buttonClasses("ghost")}
          >
            Cancel
          </Link>
        </div>
        <p className="text-xs text-subtle-foreground">
          {initial
            ? "Status is managed from the automation page (Pause / Activate)."
            : activate
              ? "Activates as soon as it is saved — the server verifies your Instagram connection first. You can pause it any time."
              : "Saved as a draft — open the automation and press Activate when you are ready to run it."}
        </p>
      </form>

      {/* Live preview — what the follower sees */}
      <Card className="p-6">
        <h2 className="text-sm font-semibold text-foreground">Preview</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          What the follower sees when the keyword matches.
        </p>

        <div className="mt-4 rounded-control bg-surface-muted p-3">
          <p className="text-xs text-subtle-foreground">On post</p>
          <p className="mt-0.5 truncate text-sm text-foreground">
            {selectedPost ? selectedPost.caption : "No post selected yet"}
          </p>
          {keyword.trim() !== "" && (
            <p className="mt-2 text-sm">
              <span className="font-medium text-foreground">@maya.skies</span>{" "}
              <span className="text-muted-foreground">
                “{keyword.trim()}”
              </span>
            </p>
          )}
        </div>

        <div className="mt-5">
          <p
            className={`text-xs font-medium uppercase tracking-wide text-muted-foreground`}
          >
            Private DM
          </p>
          {dm.trim() !== "" ? (
            <div className="mt-1.5 max-w-[85%] whitespace-pre-wrap rounded-card bg-primary-soft px-3.5 py-2.5 text-sm text-foreground">
              {renderAsFollower(dm)}
            </div>
          ) : (
            <p className="mt-1.5 text-sm text-subtle-foreground">
              Your DM preview appears here.
            </p>
          )}
        </div>

        {replyOn && (
          <div className="mt-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Public reply
            </p>
            {reply.trim() !== "" ? (
              <div className="mt-1.5 whitespace-pre-wrap rounded-card bg-surface-muted px-3.5 py-2.5 text-sm text-foreground">
                {renderAsFollower(reply)}
              </div>
            ) : (
              <p className="mt-1.5 text-sm text-subtle-foreground">
                Write a public reply to preview it.
              </p>
            )}
          </div>
        )}

        {usesVariable && (
          <p className="mt-4 text-xs text-subtle-foreground">
            Preview shows “{SAMPLE_FIRST_NAME}” for{" "}
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-700">
              {"{{first_name}}"}
            </code>
          </p>
        )}
      </Card>
    </div>
  );
}
