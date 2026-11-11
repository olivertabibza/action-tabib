import Link from "next/link";

import { cn } from "@/lib/utils";

// Profile / Network / Saved sub-tabs, shown to approved pros only. Same pill styling as
// the Chats / Requests tabs in app/messages/page.tsx.
export function ProfileTabs({
  active,
}: {
  active: "profile" | "network" | "saved";
}) {
  return (
    <div className="mb-6 flex gap-1">
      <TabLink href="/profile" label="Profile" active={active === "profile"} />
      <TabLink
        href="/profile/network"
        label="Network"
        active={active === "network"}
      />
      <TabLink href="/profile/saved" label="Saved" active={active === "saved"} />
    </div>
  );
}

function TabLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition-colors pointer-coarse:min-h-11 pointer-coarse:px-4",
        active
          ? "bg-brand text-brand-foreground"
          : "bg-muted text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </Link>
  );
}
