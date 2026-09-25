import { request } from "./client";

export interface WorkspaceInfo {
  id: string;
  name: string;
  createdAt: string;
  role: "owner" | "admin" | "member" | string;
  memberCount: number;
}

// Settings → Workspace: member-visible summary + owner/admin rename
// (server enforces the role — this is a convenience call, not the gate).
export function getWorkspace(): Promise<WorkspaceInfo | undefined> {
  return request("/workspace", () => undefined);
}

export function renameWorkspace(name: string): Promise<WorkspaceInfo> {
  return request(
    "/workspace",
    () => {
      throw new Error("Workspace rename is unavailable.");
    },
    { method: "PATCH", body: { name } },
  );
}
