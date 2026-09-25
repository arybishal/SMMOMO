import { request } from "./client";

export interface AvatarUpload {
  url: string;
  path: string;
}

// Server sniffs magic bytes and enforces size/type — the client-side checks
// in the UI are for fast feedback only, never the security boundary.
export function uploadAvatar(base64: string): Promise<AvatarUpload> {
  return request(
    "/account/avatar",
    () => {
      throw new Error("Avatar upload is unavailable.");
    },
    { method: "POST", body: { image: base64 } },
  );
}

export function deleteAvatar(path: string): Promise<{ ok: boolean }> {
  return request(
    "/account/avatar",
    () => {
      throw new Error("Avatar removal is unavailable.");
    },
    { method: "DELETE", body: { path } },
  );
}

// Storage path derived from our own public avatar URL; the API re-validates
// shape + owner prefix regardless.
export function avatarPathFromUrl(url: string): string | null {
  const marker = "/storage/v1/object/public/avatars/";
  const i = url.indexOf(marker);
  if (i === -1) return null;
  const path = url.slice(i + marker.length);
  return path === "" ? null : path;
}
