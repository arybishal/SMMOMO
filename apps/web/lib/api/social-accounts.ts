import { request } from "./client";
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
