import type { ReactNode } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";

// Session-scoped: every page here loads API data for the signed-in member
// (cookie credentials). Never prerender at build time — a build-time fetch
// has no session and would bake in 401/empty shells.
export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}
