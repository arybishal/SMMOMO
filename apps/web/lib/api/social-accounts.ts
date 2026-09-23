import { API_BASE, request } from "./client";
import { mockSocialAccounts } from "@/lib/mock/accounts";
import type { SocialAccount } from "@/types";

export function listSocialAccounts(): Promise<SocialAccount[]> {
  return request("/social-accounts", () => mockSocialAccounts);
}

export function getInstagramAccount(): Promise<SocialAccount | undefined> {
  return request("/social-accounts/instagram", () =>
    mockSocialAccounts.find((a) => a.platform === "instagram"),
  );
}

// Full-page navigation to the API (browser sends the session cookie on
// localhost — port is irrelevant for cookies), which 302s to Instagram.
export function instagramConnectHref(): string {
  return `${API_BASE}/social-accounts/instagram/connect`;
}

function mockWrite(): never {
  throw new Error("mock write not implemented — use the real API (Task 015)");
}

export function disconnectInstagram(): Promise<{ ok: boolean }> {
  return request("/social-accounts/instagram", mockWrite, {
    method: "DELETE",
  });
}
