"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const loggedOutLinks = [
  { href: "/for-creators", label: "For Industry Professionals" },
  { href: "/for-fans", label: "For Consumers" },
  { href: "/login", label: "Log in" },
];

const loggedInLinks = [
  { href: "/home", label: "Home" },
  { href: "/profile", label: "Profile" },
];

export function Nav({
  authed,
  displayName,
}: {
  authed: boolean;
  displayName: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

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

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href={authed ? "/home" : "/"}
          className="text-2xl font-bold tracking-tight text-brand"
          onClick={() => setOpen(false)}
        >
          Action
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-6 md:flex">
          {authed ? (
            <>
              {loggedInLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
              {displayName && (
                <span className="max-w-[12rem] truncate text-sm text-muted-foreground">
                  {displayName}
                </span>
              )}
              <Button
                variant="outline"
                size="lg"
                onClick={handleLogout}
                disabled={loggingOut}
              >
                <LogOut className="size-4" />
                {loggingOut ? "Logging out…" : "Log out"}
              </Button>
            </>
          ) : (
            <>
              {loggedOutLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
              <Button asChild size="lg" className="px-5">
                <Link href="/signup">Sign up</Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center justify-center rounded-md p-2 text-foreground md:hidden"
        >
          {open ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </nav>

      {/* Mobile menu */}
      <div
        className={cn(
          "border-t border-border bg-background md:hidden",
          open ? "block" : "hidden"
        )}
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-4 sm:px-6">
          {(authed ? loggedInLinks : loggedOutLinks).map((link) => (
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
