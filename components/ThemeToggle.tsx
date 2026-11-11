"use client";

import { useSyncExternalStore } from "react";
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

type ThemeChoice = "light" | "dark" | "system";

function readChoice(): ThemeChoice {
  try {
    const t = localStorage.getItem("theme");
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

function subscribeChoice(onChange: () => void) {
  window.addEventListener("themechange", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("themechange", onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * The labeled Appearance setting on the Profile pages (UX B-19): the icon-only
 * toggle used to sit in the top bar of every screen. Same storage as the boot
 * script in app/layout.tsx: "light" or "dark" in localStorage, or nothing to
 * follow the device.
 */
export function AppearanceSetting() {
  const choice = useSyncExternalStore(
    subscribeChoice,
    readChoice,
    () => "system" as ThemeChoice
  );

  function choose(next: ThemeChoice) {
    const dark =
      next === "dark" ||
      (next === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    try {
      if (next === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", next);
    } catch {
      // Private mode etc. — the class still applies for this page view.
    }
    window.dispatchEvent(new Event("themechange"));
  }

  const options: { value: ThemeChoice; label: string }[] = [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
    { value: "system", label: "Match my device" },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Appearance"
      className="flex flex-wrap gap-2"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={choice === o.value}
          onClick={() => choose(o.value)}
          className={cn(
            "focus-ring min-h-11 rounded-full border px-4 text-sm font-medium transition-colors",
            choice === o.value
              ? "border-brand bg-brand/10 text-brand"
              : "border-border text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
