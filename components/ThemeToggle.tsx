"use client";

import { Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Light/dark switch for the Callboard theme. The inline script in
 * app/layout.tsx applies the persisted class before first paint; this button
 * only has to flip the class and persist the choice. Which icon shows is
 * driven purely by the `.dark` class via CSS, so there is no mounted-state
 * dance and no hydration mismatch.
 */
export function ThemeToggle({ className }: { className?: string }) {
  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // Private mode etc. — the class still applies for this page view.
    }
  }

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={toggle}
      className={cn(
        "focus-ring flex size-9 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-surface-sunken hover:text-text-primary",
        className
      )}
    >
      <Moon className="size-[21px] dark:hidden" strokeWidth={1.5} />
      <Sun className="hidden size-[21px] dark:block" strokeWidth={1.5} />
    </button>
  );
}
