"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

// Static form shell; saving requires auth + backend (Tasks 013/014).
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
            <Input id="name" name="name" defaultValue="Bishal Aryal" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue="bishal@smmomo.com"
            />
          </div>
          <div className="pt-2">
            <Button type="submit" disabled>
              Save changes
            </Button>
            <p className="mt-2 text-xs text-subtle-foreground">
              Enabled once authentication lands (Task 013).
            </p>
          </div>
        </form>
      </Card>
    </div>
  );
}
