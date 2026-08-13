"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlignLeft,
  Briefcase,
  GraduationCap,
  Mail,
  Search,
  User,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { LogoutButton } from "@/components/LogoutButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { type NavCounts } from "@/lib/nav-counts";

// Callboard top-nav order (Feed · Projects · Classes · Network · Messages).
// Every href is a pre-existing route — Feed keeps /dashboard as its
// destination. Profile lives on the avatar in the right cluster (desktop) and
// as the fifth mobile tab; Explore is reachable through the search pill.
// `countNoun` is what a screen reader hears after the number — the badge itself
// renders a bare digit with no context, so the count goes into the link's
// accessible name too ("Messages, 1 unread").
const navItems = [
  { href: "/dashboard", label: "Feed", icon: AlignLeft, countKey: null, countNoun: null },
  { href: "/projects", label: "Projects", icon: Briefcase, countKey: "projects", countNoun: "new" },
  { href: "/classes", label: "Classes", icon: GraduationCap, countKey: "classes", countNoun: "new" },
  { href: "/network", label: "Network", icon: Users, countKey: "network", countNoun: "pending" },
  { href: "/messages", label: "Messages", icon: Mail, countKey: "messages", countNoun: "unread" },
] as const;

// Mobile swaps Messages (moved to the app bar) for Profile, per the design.
const mobileTabs = [
  ...navItems.slice(0, 4),
  { href: "/profile", label: "Profile", icon: User, countKey: null, countNoun: null },
] as const;

// undefined leaves the link's name as its visible text (the default).
function navAriaLabel(label: string, count: number, noun: string | null) {
  return count > 0 && noun ? `${label}, ${count} ${noun}` : undefined;
}

// None of these routes is an index-of-the-others (unlike "/fan"), so a simple
// prefix match is correct for each tab.
function isActive(pathname: string, href: string) {
  return pathname.startsWith(href);
}

function CountBadge({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-[5px] text-[10px] font-bold text-on-accent",
        className
      )}
    >
      {count}
    </span>
  );
}

function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex size-9 items-center justify-center rounded-[11px] bg-accent font-condensed text-[19px] font-bold text-on-accent">
        A
      </span>
      <span className="flex flex-col leading-none">
        <span className="font-condensed text-[21px] font-bold tracking-[0.01em] text-text-primary">
          ACTION
        </span>
        <span className="font-mono text-[9.5px] font-medium tracking-[0.18em] text-text-tertiary">
          PRO NETWORK
        </span>
      </span>
    </span>
  );
}

// `wide` skips the narrow inner column so a page can use the full 1248px
// canvas (the Feed's three-column grid). Everything else keeps the default.
// `counts` is required and comes from ProShellServer — this is a client
// component and cannot fetch it itself.
export function ProShell({
  children,
  counts,
  wide = false,
}: {
  children: React.ReactNode;
  counts: NavCounts;
  wide?: boolean;
}) {
  const pathname = usePathname();

  return (
    <div className="flex w-full flex-1 flex-col">
      {/* Top bar: 68px, surface, 1px bottom border, 36px side padding. */}
      <header className="sticky top-0 z-50 border-b border-border bg-surface">
        <div className="flex h-[68px] items-center gap-[22px] px-9 max-lg:gap-3.5 max-sm:px-4">
          <Link
            href="/dashboard"
            className="focus-ring rounded-md transition-opacity hover:opacity-80"
          >
            <Wordmark />
          </Link>

          {/* Search pill → Explore (the Pro search surface). */}
          <Link
            href="/explore"
            className="focus-ring hidden w-[286px] items-center gap-[9px] rounded-full border border-border-hairline bg-surface-sunken px-[15px] py-2.5 lg:flex"
          >
            <Search className="size-[17px] text-text-tertiary" strokeWidth={1.5} />
            <span className="text-sm text-text-tertiary">
              Search pros, projects, classes
            </span>
          </Link>

          <span className="flex-1" />

          {/* Desktop horizontal nav; the bottom tab bar takes over ≤640px. */}
          <nav className="flex h-[68px] items-stretch max-sm:hidden">
            {navItems.map(({ href, label, icon: Icon, countKey, countNoun }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  aria-label={navAriaLabel(
                    label,
                    countKey ? counts[countKey] : 0,
                    countNoun
                  )}
                  className={cn(
                    "focus-ring relative flex min-w-[86px] flex-col items-center justify-center gap-1 border-b-[2.5px] max-lg:min-w-16",
                    active ? "border-accent" : "border-transparent"
                  )}
                >
                  <Icon
                    className={cn(
                      "size-[22px]",
                      active ? "text-accent" : "text-text-tertiary"
                    )}
                    strokeWidth={1.5}
                  />
                  <span
                    className={cn(
                      "text-[13px]",
                      active
                        ? "font-semibold text-text-primary"
                        : "font-medium text-text-secondary"
                    )}
                  >
                    {label}
                  </span>
                  {countKey && (
                    <CountBadge
                      count={counts[countKey]}
                      className="absolute right-5 top-[11px]"
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right cluster: hairline separator, then utilities + avatar. */}
          <div className="flex items-center gap-3.5 border-l border-border-hairline pl-[18px] max-sm:border-l-0 max-sm:pl-0">
            {/* Messages lives here on mobile, where the top nav is hidden. */}
            <Link
              href="/messages"
              aria-label={
                navAriaLabel("Messages", counts.messages, "unread") ?? "Messages"
              }
              className="focus-ring relative flex size-9 items-center justify-center rounded-full text-text-tertiary sm:hidden"
            >
              <Mail className="size-[22px]" strokeWidth={1.5} />
              <CountBadge
                count={counts.messages}
                className="absolute -right-0.5 -top-0.5 h-[17px] min-w-[17px] text-[9.5px]"
              />
            </Link>
            <ThemeToggle />
            <LogoutButton
              className="focus-ring hidden items-center gap-2 rounded-full text-[13px] font-medium text-text-secondary transition-colors hover:text-text-primary disabled:opacity-50 sm:flex"
              iconClassName="size-[21px]"
              strokeWidth={1.5}
            />
            <Link
              href="/profile"
              aria-label="Profile"
              className="focus-ring flex size-9 items-center justify-center rounded-full bg-avatar-fill text-text-secondary"
            >
              <User className="size-[18px]" strokeWidth={1.5} />
            </Link>
          </div>
        </div>
      </header>

      {/* Content: 1248px canvas; bottom padding clears the mobile tab bar. */}
      <div className="flex w-full flex-1 flex-col pb-[calc(70px+env(safe-area-inset-bottom))] sm:pb-0">
        <div
          className={cn(
            "callboard-container flex flex-1 flex-col",
            // The Feed's three fixed columns need a 1272px canvas, not 1248px.
            wide && "[--callboard-canvas:1272px]"
          )}
        >
          {wide ? (
            children
          ) : (
            <div className="mx-auto flex w-full max-w-md flex-1 flex-col md:max-w-2xl">
              {children}
            </div>
          )}
        </div>
      </div>

      {/* Mobile bottom tab bar: 60px + home-indicator inset, 44px targets. */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface pb-[max(10px,env(safe-area-inset-bottom))] sm:hidden">
        <div className="flex items-stretch">
          {mobileTabs.map(({ href, label, icon: Icon, countKey, countNoun }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                aria-label={navAriaLabel(
                  label,
                  countKey ? counts[countKey] : 0,
                  countNoun
                )}
                className={cn(
                  "focus-ring relative flex h-[60px] min-w-11 flex-1 flex-col items-center justify-center gap-1",
                  active ? "text-accent" : "text-text-tertiary"
                )}
              >
                {active && (
                  <span className="absolute top-0 h-[3px] w-[34px] rounded-b-[3px] bg-accent" />
                )}
                <span className="relative">
                  <Icon className="size-[23px]" strokeWidth={1.5} />
                  {countKey && (
                    <CountBadge
                      count={counts[countKey]}
                      className="absolute -right-2 -top-1 h-4 min-w-4 text-[9.5px]"
                    />
                  )}
                </span>
                <span
                  className={cn(
                    "text-[11.5px]",
                    active
                      ? "font-semibold text-accent"
                      : "font-medium text-text-secondary"
                  )}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
