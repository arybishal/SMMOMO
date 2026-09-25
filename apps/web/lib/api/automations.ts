import { request } from "./client";
import { mockAutomations } from "@/lib/mock/automations";
import type { Automation } from "@/types";

export function listAutomations(): Promise<Automation[]> {
  return request("/automations", () => mockAutomations);
}

export function getAutomation(id: string): Promise<Automation | undefined> {
  return request(`/automations/${id}`, () =>
    mockAutomations.find((a) => a.id === id),
  );
}

export interface AutomationInput {
  postId: string;
  keyword: string;
  privateReply: string;
  publicReply: string | null;
  name?: string;
  /** New automations only: server re-validates connection before activating. */
  activate?: boolean;
}

function mockWrite(): never {
  throw new Error("mock write not implemented — use the real API (Task 014)");
}

export function createAutomation(input: AutomationInput): Promise<Automation> {
  return request(
    "/automations",
    mockWrite,
    { method: "POST", body: input },
  );
}

export function updateAutomation(
  id: string,
  patch: Partial<AutomationInput> & { status?: Automation["status"] },
): Promise<Automation> {
  return request(
    `/automations/${id}`,
    mockWrite,
    { method: "PATCH", body: patch },
  );
}
