import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Full-width segmented tabs that switch a page's view through its URL
 * (`?tab=…`), used by Classes, Projects and fan Explore (Step 4 redesigns).
 * Plain links, so every view is shareable and works without JavaScript.
 */
export function SegmentedTabs({
  label,
  tabs,
  className,
}: {
  /** Names the group for screen readers, e.g. "Classes views". */
  label: string;
  tabs: { href: string; label: string; active: boolean; count?: number }[];
  className?: string;
}) {
  return (
    <nav
      aria-label={label}
      className={cn(
        "grid gap-1 rounded-xl bg-muted p-1",
        tabs.length === 2 && "grid-cols-2",
        tabs.length === 3 && "grid-cols-3",
        className
      )}
    >
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          scroll={false}
          className={cn(
            "focus-ring flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-2 text-sm transition-colors",
            t.active
              ? "bg-card font-semibold text-foreground shadow-sm"
              : "font-medium text-muted-foreground hover:text-foreground"
          )}
        >
          {t.label}
          {t.count !== undefined && t.count > 0 && (
            <span className="rounded-full bg-brand/10 px-1.5 text-xs font-semibold text-brand">
              {t.count}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
