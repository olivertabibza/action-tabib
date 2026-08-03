"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const loggedOutLinks = [
  { href: "/for-creators", label: "For Industry Professionals" },
  { href: "/for-fans", label: "For Consumers" },
  { href: "/login", label: "Log in" },
];

export function Nav({
  authed,
  displayName,
  isAdmin,
  isApprovedPro,
  isConsumer,
}: {
  authed: boolean;
  displayName: string | null;
  isAdmin: boolean;
  isApprovedPro: boolean;
  isConsumer: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // The root layout computes `isConsumer` once and — because Next caches
  // layouts and does NOT re-render them on client-side navigation — that value
  // goes stale right after a fan signs in (the layout rendered while logged out
  // is reused, so Projects wrongly stays). This nav is a Client Component, which
  // DOES re-render on navigation: seed from the server prop (correct on a fresh
  // load, no flash), then re-read the account type when auth state changes.
  const [consumer, setConsumer] = useState(isConsumer);

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // INITIAL_SESSION / TOKEN_REFRESHED don't change the account type, and the
      // SSR seed already covers a fresh load — only react to real auth changes.
      if (event === "SIGNED_OUT") {
        setConsumer(false);
        return;
      }
      if (event !== "SIGNED_IN" && event !== "USER_UPDATED") return;
      if (!session?.user) return;
      // A fresh login clears any stale "Logging out…" label left over from a
      // cached render.
      if (event === "SIGNED_IN") setLoggingOut(false);
      supabase
        .from("profiles")
        .select("account_type")
        .eq("id", session.user.id)
        .maybeSingle()
        .then(({ data }) => setConsumer(data?.account_type === "consumer"));
    });
    return () => subscription.unsubscribe();
  }, []);

  // Projects (the marketplace) is Pro-only — never shown to consumers (fans).
  // Dashboard + Network are only for approved professionals; Admin only for
  // admins. All are appended to the base Home/Profile links.
  const links = [
    { href: "/home", label: "Home" },
    ...(!consumer ? [{ href: "/projects", label: "Projects" }] : []),
    { href: "/profile", label: "Profile" },
    ...(isApprovedPro
      ? [
          { href: "/dashboard", label: "Dashboard" },
          { href: "/network", label: "Network" },
        ]
      : []),
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  async function handleLogout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    setOpen(false);
    // Back to the marketing landing page, then refresh so the nav + any
    // server components re-render in their logged-out state.
    router.push("/");
    router.refresh();
  }

  // The Fan and Pro apps each have their own shell (sidebar + bottom tab bar)
  // and no global top nav, so hide this nav there.
  const shellRoutes = ["/fan", "/dashboard", "/network", "/projects", "/messages"];
  if (shellRoutes.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  // /profile is shared, so it's NOT in shellRoutes: consumers and anon visitors
  // (incl. /profile/[id]) keep the top nav. But approved pros get the Pro shell
  // there (see app/profile/layout.tsx), so hide the top nav for them to avoid
  // stacking it on the shell sidebar.
  if (isApprovedPro && pathname.startsWith("/profile")) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-surface">
      <nav className="mx-auto flex h-[68px] w-full max-w-[1320px] items-center justify-between px-4 sm:px-9">
        <Link
          href={authed ? "/home" : "/"}
          className="focus-ring flex items-center gap-2.5 rounded-md transition-opacity hover:opacity-80"
          onClick={() => setOpen(false)}
        >
          <span className="flex size-9 items-center justify-center rounded-[11px] bg-accent font-condensed text-[19px] font-bold text-on-accent">
            A
          </span>
          <span className="font-condensed text-[21px] font-bold tracking-[0.01em] text-text-primary">
            ACTION
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden h-full items-center gap-6 md:flex">
          {authed ? (
            <>
              {links.map((link) => {
                const active = pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "focus-ring flex h-full items-center border-b-[2.5px] text-sm transition-colors",
                      active
                        ? "border-accent font-semibold text-text-primary"
                        : "border-transparent font-medium text-text-secondary hover:text-text-primary"
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}
              {displayName && (
                <span className="max-w-[12rem] truncate text-sm text-text-tertiary">
                  {displayName}
                </span>
              )}
              <ThemeToggle />
              <Button
                variant="outline"
                size="lg"
                onClick={handleLogout}
                disabled={loggingOut}
              >
                <LogOut className="size-4" strokeWidth={1.5} />
                {loggingOut ? "Logging out…" : "Log out"}
              </Button>
            </>
          ) : (
            <>
              {loggedOutLinks.map((link) => {
                const active = pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "focus-ring flex h-full items-center border-b-[2.5px] text-sm transition-colors",
                      active
                        ? "border-accent font-semibold text-text-primary"
                        : "border-transparent font-medium text-text-secondary hover:text-text-primary"
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}
              <ThemeToggle />
              <Button asChild size="lg" className="px-5">
                <Link href="/signup">Sign up</Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="focus-ring inline-flex items-center justify-center rounded-md p-2 text-foreground"
          >
            {open ? (
              <X className="size-6" strokeWidth={1.5} />
            ) : (
              <Menu className="size-6" strokeWidth={1.5} />
            )}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <div
        className={cn(
          "border-t border-border-hairline bg-surface md:hidden",
          open ? "block" : "hidden"
        )}
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-4 sm:px-6">
          {(authed ? links : loggedOutLinks).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-2 text-base font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
          {authed ? (
            <Button
              variant="outline"
              size="lg"
              onClick={handleLogout}
              disabled={loggingOut}
              className="mt-2 w-full"
            >
              <LogOut className="size-4" />
              {loggingOut ? "Logging out…" : "Log out"}
            </Button>
          ) : (
            <Button asChild size="lg" className="mt-2 w-full">
              <Link href="/signup" onClick={() => setOpen(false)}>
                Sign up
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
