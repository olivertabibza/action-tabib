"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlignLeft,
  Briefcase,
  Circle,
  GraduationCap,
  Search,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { LogoutButton } from "@/components/LogoutButton";
import { MessagesNavButton } from "@/app/messages/messages-nav-button";

// Single source of truth for the Pro app's destinations — shared by the desktop
// sidebar and the mobile bottom tab bar so the two can't drift apart. Messages
// lives in a fixed top-right button instead (see ProShell). Network is a
// top-level tab next to the Feed: discovering pros to follow is what fills the
// (follow-only) Feed.
const navItems = [
  { href: "/dashboard", label: "Feed", icon: AlignLeft },
  { href: "/network", label: "Network", icon: Users },
  { href: "/projects", label: "Projects", icon: Briefcase },
  { href: "/classes", label: "Classes", icon: GraduationCap },
  { href: "/explore", label: "Explore", icon: Search },
  { href: "/profile", label: "Profile", icon: Circle },
] as const;

// None of these routes is an index-of-the-others (unlike "/fan"), so a simple
// prefix match is correct for each tab.
function isActive(pathname: string, href: string) {
  return pathname.startsWith(href);
}

function Wordmark() {
  return (
    <div className="flex items-center gap-2">
      <span className="text-2xl font-bold tracking-tight">Action</span>
      <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">
        Pro
      </span>
    </div>
  );
}

export function ProShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex w-full flex-1">
      {/* Messages: fixed top-right on every Pro screen, both desktop and mobile.
          Sits above content so it never overlaps the page body. Carries the
          unread-count badge. */}
      <MessagesNavButton />

      {/* Desktop: left sidebar (hidden below md) */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border px-4 py-6 md:flex">
        <div className="px-2">
          <Link
            href="/dashboard"
            className="inline-block transition-opacity hover:opacity-80"
          >
            <Wordmark />
          </Link>
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

        {/* Pinned to the bottom of the sidebar — mobile logout lives on the
            Profile page instead (the bottom bar is already full). */}
        <LogoutButton className="mt-auto flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50" />
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
