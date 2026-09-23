import { request } from "./client";

export interface AdminMetaConfig {
  appId: string;
  appSecretConfigured: boolean;
  webhookVerifyTokenConfigured: boolean;
  redirectUri: string;
  source: {
    appId: "db" | "env" | "none";
    appSecret: "db" | "env" | "none";
    webhookVerifyToken: "db" | "env" | "none";
  };
  metaConfigured: boolean;
  oauthReady: boolean;
  webhookReady: boolean;
  updatedAt: string | null;
}

export interface AdminMetaSaveInput {
  appId?: string;
  appSecret?: string;
  webhookVerifyToken?: string;
}

/** 401/403 throw — callers treat any error as "not authorized / not admin". */
export function getAdminMetaConfig(): Promise<AdminMetaConfig> {
  return request(
    "/admin/integrations/meta",
    () => {
      throw new Error("mock unsupported");
    },
  );
}

export function saveAdminMetaConfig(
  input: AdminMetaSaveInput,
): Promise<AdminMetaConfig> {
  return request(
    "/admin/integrations/meta",
    () => {
      throw new Error("mock unsupported");
    },
    { method: "PUT", body: input },
  );
}

export function testAdminMetaConfig(): Promise<{
  appIdPresent: boolean;
  appSecretPresent: boolean;
  webhookVerifyTokenPresent: boolean;
  redirectUriPresent: boolean;
  metaConfigured: boolean;
  oauthReady: boolean;
  webhookReady: boolean;
  source: AdminMetaConfig["source"];
}> {
  return request(
    "/admin/integrations/meta/test",
    () => {
      throw new Error("mock unsupported");
    },
    // Empty object so fetch always sends application/json (bare POST → 415).
    { method: "POST", body: {} },
  );
}
