"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Tells the server the browser's time zone (lib/datetime.ts), once per
 * browser and again only if it changes (travel, a new laptop). After the first
 * write the page re-renders so its dates are already in the right zone.
 */
export function TimeZoneCookie() {
  const router = useRouter();
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!tz) return;
      const current = document.cookie
        .split("; ")
        .find((c) => c.startsWith("tz="))
        ?.slice(3);
      if (current === tz) return;
      document.cookie = `tz=${tz}; path=/; max-age=31536000; samesite=lax`;
      router.refresh();
    } catch {
      // No zone available: the server keeps its default.
    }
  }, [router]);
  return null;
}
