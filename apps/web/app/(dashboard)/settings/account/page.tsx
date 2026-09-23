"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

// Static form shell: values are placeholder identity until a real user API
// exists; saving and password changes require auth + backend (Tasks 013/014),
// so Save stays disabled with a visible, honest reason.
export default function AccountSettingsPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Account"
        description="Your profile details."
      />

      <Card className="p-6">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              autoComplete="name"
              defaultValue="Bishal Aryal"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              defaultValue="bishal@smmomo.com"
            />
          </div>

          <div className="border-t border-border-muted pt-4">
            <CardTitle>Password</CardTitle>
            <div className="mt-3 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="current-password">Current password</Label>
                <Input
                  id="current-password"
                  name="current-password"
                  type="password"
                  autoComplete="current-password"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  name="new-password"
                  type="password"
                  autoComplete="new-password"
                />
              </div>
            </div>
          </div>

          <div className="pt-2">
            <Button type="submit" disabled>
              Save changes
            </Button>
            <p className="mt-2 text-xs text-subtle-foreground">
              Save stays disabled until authentication lands (Task 013) — no
              fake persistence yet.
            </p>
          </div>
        </form>
      </Card>
    </div>
  );
}
