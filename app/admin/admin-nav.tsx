import Link from "next/link";

import { cn } from "@/lib/utils";

/** Shared sub-nav for the admin sections. */
export function AdminNav({
  active,
}: {
  active: "applications" | "projects" | "content";
}) {
  const tabs = [
    { href: "/admin", label: "Applications", key: "applications" },
    { href: "/admin/projects", label: "Listings", key: "projects" },
    { href: "/admin/content", label: "Content", key: "content" },
  ] as const;

  return (
    <nav className="mb-8 flex gap-1">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
            active === tab.key
              ? "bg-brand/10 text-brand"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
