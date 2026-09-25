import { redirect } from "next/navigation";

// Old hub (link list) replaced by the grouped Settings navigation.
// Keep the URL alive: sidebar + bookmarks land on Profile.
export default function SettingsPage() {
  redirect("/settings/account");
}
