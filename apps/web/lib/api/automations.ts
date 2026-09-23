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
