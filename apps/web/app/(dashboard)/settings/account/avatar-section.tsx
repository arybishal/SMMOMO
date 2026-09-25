"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getBrowserSupabase } from "@/lib/supabase/client";
import {
  avatarPathFromUrl,
  deleteAvatar,
  uploadAvatar,
} from "@/lib/api/avatar";

const MAX_BYTES = 2 * 1024 * 1024;

// Magic-byte sniff (same rules as the API — feedback only; the API is the
// boundary). JPEG: FF D8 FF · PNG: 8-byte signature · WebP: RIFF....WEBP.
function sniff(head: Uint8Array): boolean {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff)
    return true;
  if (
    head.length >= 8 &&
    head[0] === 0x89 &&
    head[1] === 0x50 &&
    head[2] === 0x4e &&
    head[3] === 0x47 &&
    head[4] === 0x0d &&
    head[5] === 0x0a &&
    head[6] === 0x1a &&
    head[7] === 0x0a
  )
    return true;
  if (head.length >= 12) {
    const riff = String.fromCharCode(...head.subarray(0, 4));
    const webp = String.fromCharCode(...head.subarray(8, 12));
    if (riff === "RIFF" && webp === "WEBP") return true;
  }
  return false;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

export function AvatarSection({
  url,
  name,
  email,
}: {
  url: string;
  name: string;
  email: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<
    { kind: "success"; message: string } | { kind: "error"; message: string } | null
  >(null);

  const initials = (name || email).trim().charAt(0).toUpperCase() || "?";

  // Swap file input value so re-selecting the same file re-fires change.
  useEffect(() => {
    if (inputRef.current) inputRef.current.value = "";
  }, [file]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    setStatus(null);
    const picked = e.target.files?.[0];
    if (!picked) return;
    if (picked.size > MAX_BYTES) {
      setStatus({ kind: "error", message: "Image must be 2MB or smaller." });
      return;
    }
    try {
      const head = new Uint8Array(
        await picked.slice(0, 12).arrayBuffer(),
      );
      if (!sniff(head)) {
        setStatus({
          kind: "error",
          message: "Unsupported image — use a JPG, PNG, or WebP file.",
        });
        return;
      }
      const dataUrl = await readFileAsDataUrl(picked);
      setFile(picked);
      setPreview(dataUrl);
    } catch {
      setStatus({ kind: "error", message: "Could not read that file — try again." });
    }
  }

  function cancelPreview() {
    setFile(null);
    setPreview("");
    setStatus(null);
  }

  async function savePreview() {
    if (!file || !preview) return;
    setBusy(true);
    setStatus(null);
    try {
      const base64 = preview.slice(preview.indexOf(",") + 1);
      const { url: avatarUrl } = await uploadAvatar(base64);
      const { error } = await getBrowserSupabase().auth.updateUser({
        data: { avatar_url: avatarUrl },
      });
      if (error) throw new Error("save");
      setFile(null);
      setPreview("");
      setStatus({ kind: "success", message: "Profile picture updated." });
      router.refresh();
    } catch (err) {
      setStatus({
        kind: "error",
        message:
          err instanceof Error && err.message && err.message !== "save"
            ? err.message
            : "Could not save your profile picture — try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function removeAvatar() {
    if (!window.confirm("Remove your profile picture?")) return;
    setBusy(true);
    setStatus(null);
    try {
      // Clear first (profile state is the source of truth), then the file.
      const { error } = await getBrowserSupabase().auth.updateUser({
        data: { avatar_url: null },
      });
      if (error) throw new Error("save");
      const path = avatarPathFromUrl(url);
      if (path) {
        try {
          await deleteAvatar(path);
        } catch {
          // Orphaned object is invisible and overwritten on next upload.
        }
      }
      setStatus({ kind: "success", message: "Profile picture removed." });
      router.refresh();
    } catch {
      setStatus({
        kind: "error",
        message: "Could not remove your profile picture — try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  const shown = preview || url;

  return (
    <div className="shrink-0">
      <div className="relative h-16 w-16 overflow-hidden rounded-full bg-zinc-100 ring-1 ring-inset ring-zinc-200">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shown}
            alt={name ? `${name}'s profile picture` : "Profile picture"}
            className="h-full w-full object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="flex h-full w-full items-center justify-center text-lg font-semibold text-zinc-500"
          >
            {initials}
          </span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-label="Choose a profile picture"
        onChange={onPick}
      />

      <div className="mt-2 flex flex-wrap gap-1.5">
        {preview ? (
          <>
            <Button
              type="button"
              className="px-2.5 py-1.5 text-xs"
              disabled={busy}
              onClick={savePreview}
            >
              {busy ? "Saving…" : "Save photo"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="px-2.5 py-1.5 text-xs"
              disabled={busy}
              onClick={cancelPreview}
            >
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              className="px-2.5 py-1.5 text-xs"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {url ? "Replace" : "Upload"}
            </Button>
            {url && (
              <Button
                type="button"
                variant="secondary"
                className="px-2.5 py-1.5 text-xs"
                disabled={busy}
                onClick={removeAvatar}
              >
                Remove
              </Button>
            )}
          </>
        )}
      </div>

      {status && (
        <p
          role={status.kind === "error" ? "alert" : "status"}
          className={`mt-2 max-w-40 text-xs ${
            status.kind === "error"
              ? "text-danger-strong"
              : "text-success-strong"
          }`}
        >
          {status.message}
        </p>
      )}
    </div>
  );
}
