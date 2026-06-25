"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Shared logout control. Reuses the exact sign-out flow from Nav.tsx
 * (signOut → push("/") → refresh) so every entry point behaves identically.
 * Styling is left to the caller via `className`; it renders the LogOut icon and
 * a label that flips to "Logging out…" while the request is in flight.
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

  async function handleLogout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    // Back to the marketing landing page, then refresh so server components
    // re-render in their logged-out state.
    router.push("/");
    router.refresh();
  }

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
