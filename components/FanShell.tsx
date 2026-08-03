"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlignLeft, Calendar, Search, User } from "lucide-react";

import { cn } from "@/lib/utils";
import { LogoutButton } from "@/components/LogoutButton";
import { ThemeToggle } from "@/components/ThemeToggle";

// Single source of truth for the Fan app's destinations — shared by the
// desktop top nav and the mobile bottom tab bar so the two can't drift apart.
const navItems = [
  { href: "/fan", label: "Feed", icon: AlignLeft },
  { href: "/fan/explore", label: "Explore", icon: Search },
  { href: "/fan/events", label: "Events", icon: Calendar },
  { href: "/fan/profile", label: "Profile", icon: User },
] as const;

// Feed lives at the index route, so it must match exactly — every other tab's
// path startsWith "/fan" too.
function isActive(pathname: string, href: string) {
  return href === "/fan" ? pathname === "/fan" : pathname.startsWith(href);
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
          FAN
        </span>
      </span>
    </span>
  );
}

export function FanShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex w-full flex-1 flex-col">
      {/* Top bar: 68px, surface, 1px bottom border, 36px side padding. */}
      <header className="sticky top-0 z-50 border-b border-border bg-surface">
        <div className="flex h-[68px] items-center gap-[22px] px-9 max-lg:gap-3.5 max-sm:px-4">
          <Link
            href="/fan"
            className="focus-ring rounded-md transition-opacity hover:opacity-80"
          >
            <Wordmark />
          </Link>

          {/* Search pill → Explore (the Fan search surface). */}
          <Link
            href="/fan/explore"
            className="focus-ring hidden w-[286px] items-center gap-[9px] rounded-full border border-border-hairline bg-surface-sunken px-[15px] py-2.5 lg:flex"
          >
            <Search className="size-[17px] text-text-tertiary" strokeWidth={1.5} />
            <span className="text-sm text-text-tertiary">
              Search creators, events
            </span>
          </Link>

          <span className="flex-1" />

          {/* Desktop horizontal nav; the bottom tab bar takes over ≤640px. */}
          <nav className="flex h-[68px] items-stretch max-sm:hidden">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
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
                </Link>
              );
            })}
          </nav>

          {/* Right cluster — mobile logout lives on the Profile page instead. */}
          <div className="flex items-center gap-3.5 border-l border-border-hairline pl-[18px] max-sm:border-l-0 max-sm:pl-0">
            <ThemeToggle />
            <LogoutButton
              className="focus-ring hidden items-center gap-2 rounded-full text-[13px] font-medium text-text-secondary transition-colors hover:text-text-primary disabled:opacity-50 sm:flex"
              iconClassName="size-[21px]"
              strokeWidth={1.5}
            />
          </div>
        </div>
      </header>

      {/* Content: 1248px canvas; bottom padding clears the mobile tab bar. */}
      <div className="flex w-full flex-1 flex-col pb-[calc(70px+env(safe-area-inset-bottom))] sm:pb-0">
        <div className="callboard-container flex flex-1 flex-col">
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col md:max-w-2xl">
            {children}
          </div>
        </div>
      </div>

      {/* Mobile bottom tab bar: 60px + home-indicator inset, 44px targets. */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface pb-[max(10px,env(safe-area-inset-bottom))] sm:hidden">
        <div className="flex items-stretch">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-ring relative flex h-[60px] min-w-11 flex-1 flex-col items-center justify-center gap-1",
                  active ? "text-accent" : "text-text-tertiary"
                )}
              >
                {active && (
                  <span className="absolute top-0 h-[3px] w-[34px] rounded-b-[3px] bg-accent" />
                )}
                <Icon className="size-[23px]" strokeWidth={1.5} />
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
