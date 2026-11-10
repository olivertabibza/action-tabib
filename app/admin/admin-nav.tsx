import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

/**
 * Shared sub-nav for the admin sections. Shows what's waiting on each tab
 * (UX B-30), so the counts aren't only visible on Settings.
 */
export async function AdminNav({
  active,
}: {
  active: "applications" | "projects" | "content" | "settings";
}) {
  const supabase = await createClient();
  const pending = (table: "classes" | "events" | "articles") =>
    supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
  const [pros, classes, events, articles] = await Promise.all([
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("account_type", "professional")
      .eq("application_status", "pending"),
    pending("classes"),
    pending("events"),
    pending("articles"),
  ]);
  const waiting: Partial<Record<typeof active, number>> = {
    applications: pros.count ?? 0,
    content: (classes.count ?? 0) + (events.count ?? 0) + (articles.count ?? 0),
  };

  const tabs = [
    { href: "/admin", label: "Applications", key: "applications" },
    // UX B-30: "Listings" was unclear; these are projects.
    { href: "/admin/projects", label: "Projects", key: "projects" },
    { href: "/admin/content", label: "Content", key: "content" },
    { href: "/admin/settings", label: "Settings", key: "settings" },
  ] as const;

  return (
    <nav aria-label="Admin sections" className="mb-8 flex flex-wrap gap-1">
      {tabs.map((tab) => {
        const count = waiting[tab.key] ?? 0;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active === tab.key ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors",
              active === tab.key
                ? "bg-brand/10 text-brand"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {tab.label}
            {count > 0 && (
              <span className="rounded-full bg-brand px-1.5 py-0.5 text-[11px] font-semibold leading-none text-brand-foreground">
                {count}
                <span className="sr-only"> waiting</span>
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
