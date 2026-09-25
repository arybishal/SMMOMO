"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { renameWorkspace } from "@/lib/api/workspace";

type Status =
  | { kind: "idle" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export function WorkspaceForm({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pending, setPending] = useState(false);

  const dirty = name !== initialName;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ kind: "idle" });
    const trimmed = name.trim();
    if (trimmed === "" || trimmed.length > 100) {
      setStatus({
        kind: "error",
        message: "Workspace name must be 1-100 characters.",
      });
      return;
    }
    setPending(true);
    try {
      await renameWorkspace(trimmed);
      setStatus({ kind: "success", message: "Workspace renamed." });
      router.refresh();
    } catch (err) {
      setStatus({
        kind: "error",
        message:
          err instanceof Error && err.message
            ? err.message.slice(0, 200)
            : "Could not rename the workspace — try again.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      {status.kind === "success" && (
        <p
          role="status"
          className="rounded-control bg-success-soft px-3 py-2 text-sm text-success-strong"
        >
          {status.message}
        </p>
      )}
      {status.kind === "error" && (
        <p
          role="alert"
          className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger-strong"
        >
          {status.message}
        </p>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="workspace-name">Workspace name</Label>
        <Input
          id="workspace-name"
          name="workspace-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          placeholder="Workspace name"
        />
      </div>
      <Button type="submit" disabled={pending || !dirty}>
        {pending ? "Saving…" : "Save name"}
      </Button>
    </form>
  );
}
