"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { COUNTRIES, DIAL_CODES } from "@/lib/profile/countries";
import { supportedTimeZones } from "@/lib/profile/timezones";

type Status =
  | { kind: "idle" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export function ProfileForm({
  name: initialName,
  country: initialCountry,
  timezone: initialTimezone,
  phoneCc: initialPhoneCc,
  phoneNumber: initialPhoneNumber,
}: {
  name: string;
  country: string;
  timezone: string;
  phoneCc: string;
  phoneNumber: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [country, setCountry] = useState(initialCountry);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [phoneCc, setPhoneCc] = useState(initialPhoneCc);
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber);
  const [zones, setZones] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pending, setPending] = useState(false);

  // Timezone list comes from the runtime's IANA database after hydration
  // (server never renders it — no ICU mismatch between server and browser).
  // One-shot mount sync from an external system; no render cascade.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time init
    setZones(supportedTimeZones());
  }, []);

  const dirty = useMemo(
    () =>
      name !== initialName ||
      country !== initialCountry ||
      timezone !== initialTimezone ||
      phoneCc !== initialPhoneCc ||
      phoneNumber !== initialPhoneNumber,
    [
      name,
      country,
      timezone,
      phoneCc,
      phoneNumber,
      initialName,
      initialCountry,
      initialTimezone,
      initialPhoneCc,
      initialPhoneNumber,
    ],
  );

  // Basic accidental-loss guard (refresh/close). In-app soft navigation
  // interception is unreliable across routers — out of scope on purpose.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ kind: "idle" });

    if (name.trim() === "") {
      setStatus({ kind: "error", message: "Full name is required." });
      return;
    }
    if (name.trim().length > 100) {
      setStatus({ kind: "error", message: "Name must be 100 characters or fewer." });
      return;
    }
    const hasCc = phoneCc !== "";
    const hasNumber = phoneNumber.trim() !== "";
    if (hasCc !== hasNumber) {
      setStatus({
        kind: "error",
        message: "Enter both a country code and a phone number, or leave both blank.",
      });
      return;
    }
    if (hasNumber && !/^\d{4,14}$/.test(phoneNumber.trim())) {
      setStatus({
        kind: "error",
        message: "Phone number must be 4-14 digits (no spaces or symbols).",
      });
      return;
    }

    setPending(true);
    try {
      const { error } = await getBrowserSupabase().auth.updateUser({
        data: {
          name: name.trim(),
          country,
          timezone,
          phone_cc: hasCc ? phoneCc : null,
          phone_number: hasNumber ? phoneNumber.trim() : null,
        },
      });
      if (error) {
        const msg = (error.message ?? "").toLowerCase();
        if (
          (error.code ?? "") === "over_request_rate_limit" ||
          msg.includes("rate limit")
        ) {
          setStatus({
            kind: "error",
            message: "Too many attempts. Wait a moment and try again.",
          });
        } else {
          setStatus({
            kind: "error",
            message: "Something went wrong — try again.",
          });
        }
        return;
      }
      setStatus({ kind: "success", message: "Profile saved." });
      router.refresh();
    } catch {
      setStatus({
        kind: "error",
        message: "Could not reach the server — try again.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      {status.kind === "success" && (
        <p
          role="status"
          className="rounded-control bg-success-soft px-3 py-2 text-sm text-success-strong"
        >
          {status.message}
        </p>
      )}
      {status.kind === "error" && (
        <p
          role="alert"
          className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger-strong"
        >
          {status.message}
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="profile-name">Full name</Label>
        <Input
          id="profile-name"
          name="name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          maxLength={100}
          required
          aria-invalid={name.trim() === ""}
          aria-describedby="profile-name-hint"
        />
        <p id="profile-name-hint" className="text-xs text-muted-foreground">
          Shown across SMMOMO and on your profile.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="profile-country">Country</Label>
          <Select
            id="profile-country"
            name="country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          >
            <option value="">Not set</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="profile-timezone">Timezone</Label>
          <Select
            id="profile-timezone"
            name="timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          >
            <option value="">Not set</option>
            {timezone !== "" && !zones.includes(timezone) && (
              <option value={timezone}>{timezone}</option>
            )}
            {zones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="profile-phone">Phone number</Label>
        <div className="flex gap-2">
          <Select
            id="profile-phone-cc"
            aria-label="Phone country code"
            className="w-28 shrink-0"
            value={phoneCc}
            onChange={(e) => setPhoneCc(e.target.value)}
          >
            <option value="">+</option>
            {phoneCc !== "" && !DIAL_CODES.includes(phoneCc) && (
              <option value={phoneCc}>{phoneCc}</option>
            )}
            {DIAL_CODES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
          <Input
            id="profile-phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            className="flex-1"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value.replace(/\s/g, ""))}
            placeholder="9800000000"
            aria-describedby="profile-phone-hint"
          />
        </div>
        <p id="profile-phone-hint" className="text-xs text-muted-foreground">
          SMS verification isn&apos;t configured yet — the number won&apos;t be
          marked verified.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || !dirty}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
        {dirty && !pending && (
          <span className="text-xs text-muted-foreground">Unsaved changes</span>
        )}
      </div>
    </form>
  );
}
