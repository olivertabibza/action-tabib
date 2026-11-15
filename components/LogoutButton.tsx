"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Shared logout control. Reuses the exact sign-out flow from Nav.tsx
 * (signOut → push("/") → refresh) so every entry point behaves identically.
 * Styling is left to the caller via `className`; it renders the LogOut icon and
 * a label that flips to "Logging out…" while the request is in flight.
 *
 * Hidden for demo guests (anonymous sign-ins, supabase/demo-guests.sql): they
 * have no email or password, so logging out would lose the account for good.
 * It renders nothing until the session is read, so a guest never sees it.
 */
export function LogoutButton({
  className,
  iconClassName,
  strokeWidth = 1.75,
}: {
  className?: string;
  iconClassName?: string;
  strokeWidth?: number;
}) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [canLogOut, setCanLogOut] = useState(false);

  useEffect(() => {
    createClient()
      .auth.getSession()
      .then(({ data }) => setCanLogOut(!data.session?.user.is_anonymous));
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    // Back to the marketing landing page, then refresh so server components
    // re-render in their logged-out state.
    router.push("/");
    router.refresh();
  }

  if (!canLogOut) return null;

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loggingOut}
      className={className}
    >
      <LogOut className={cn("size-5", iconClassName)} strokeWidth={strokeWidth} />
      {loggingOut ? "Logging out…" : "Log out"}
    </button>
  );
}
