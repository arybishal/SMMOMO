"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { buttonClasses } from "@/components/ui/button";

// Task 027 — local automation simulator (spec §32). Purely client-side: the
// match rule mirrors apps/api/src/engine.ts (case-insensitive substring) but
// nothing is sent, created, or counted. No data-layer imports by design.

const SAMPLE_FIRST_NAME = "Sarah";

export function Simulator({ keyword, dm }: { keyword: string; dm: string }) {
  const [sample, setSample] = useState("I want the price");
  const [result, setResult] = useState<boolean | null>(null);

  function test() {
    // Exact engine rule: non-empty keyword, case-insensitive substring.
    setResult(
      keyword.trim() !== "" &&
        sample.toLowerCase().includes(keyword.toLowerCase()),
    );
  }

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">
          Test your automation
        </h2>
        <span className="text-xs text-subtle-foreground">
          Local test — nothing is sent
        </span>
      </div>

      <div className="mt-4 space-y-1.5">
        <Label htmlFor="sim-sample">Sample comment</Label>
        <Input
          id="sim-sample"
          type="text"
          maxLength={200}
          value={sample}
          onChange={(e) => {
            setSample(e.target.value);
            setResult(null);
          }}
          placeholder="Write a sample comment"
        />
      </div>

      <div className="mt-3 flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Keyword</span>
        <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-700">
          {keyword.trim() !== "" ? keyword : "not set yet"}
        </code>
      </div>

      <button type="button" onClick={test} className={`${buttonClasses("secondary")} mt-4`}>
        Test comment
      </button>

      {result !== null && (
        <div className="mt-4 space-y-3">
          <p
            className={`text-sm font-medium ${
              result ? "text-success-strong" : "text-muted-foreground"
            }`}
          >
            {result ? "✓ Keyword matched" : "✕ No match — this comment would be ignored"}
          </p>
          {result && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Private DM
              </p>
              <div className="mt-1.5 whitespace-pre-wrap rounded-card bg-primary-soft px-3.5 py-2.5 text-sm text-foreground">
                {dm.trim() !== ""
                  ? dm.replace(/\{\{first_name\}\}/g, SAMPLE_FIRST_NAME)
                  : "No DM written yet."}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
