"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlignLeft, Calendar, Circle, FileText, Search } from "lucide-react";

import { cn } from "@/lib/utils";

// Single source of truth for the Fan app's destinations — shared by the desktop
// sidebar and the mobile bottom tab bar so the two can't drift apart.
const navItems = [
  { href: "/fan", label: "Feed", icon: AlignLeft },
  { href: "/fan/discover", label: "Discover", icon: Search },
  { href: "/fan/events", label: "Events", icon: Calendar },
  { href: "/fan/read", label: "Read", icon: FileText },
  { href: "/fan/profile", label: "Profile", icon: Circle },
] as const;

// Feed lives at the index route, so it must match exactly — every other tab's
// path startsWith "/fan" too.
function isActive(pathname: string, href: string) {
  return href === "/fan" ? pathname === "/fan" : pathname.startsWith(href);
}

function Wordmark() {
  return (
    <div className="flex items-center gap-2">
      <span className="text-2xl font-bold tracking-tight">Action</span>
      <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">
        Fan
      </span>
    </div>
  );
}

export function FanShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex w-full flex-1">
      {/* Desktop: left sidebar (hidden below md) */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border px-4 py-6 md:flex">
        <div className="px-2">
          <Wordmark />
        </div>
        <nav className="mt-8 flex flex-col gap-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-brand/10 text-brand"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Content column — centered and width-capped; bottom padding clears the
          mobile bar, dropped on desktop where the bar is hidden. */}
      <div className="flex w-full flex-1 flex-col pb-20 md:pb-0">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col md:max-w-2xl">
          {children}
        </div>
      </div>

      {/* Mobile: fixed bottom tab bar (hidden md and up) */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
        <div className="mx-auto flex max-w-md items-stretch justify-around">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors",
                  active
                    ? "text-brand"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
