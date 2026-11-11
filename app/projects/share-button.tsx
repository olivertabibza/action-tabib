"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";

/**
 * The share icon beside a project's title on its page (it left the browse
 * cards in UX B-06). There is no share target to
 * post to, so this does the one honest thing available: copies the project's
 * URL to the clipboard. It is NOT a dead button.
 */
export function ShareButton({ path, title }: { path: string; title: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      aria-label={copied ? "Link copied" : `Copy link to ${title}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(`${window.location.origin}${path}`);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          // Clipboard denied (insecure origin, or the user said no) — the icon
          // simply doesn't confirm. Nothing else to fall back to.
        }
      }}
      className="focus-ring flex size-8 items-center justify-center rounded-full text-text-tertiary transition-colors hover:text-accent"
    >
      {copied ? (
        <Check className="size-5 text-accent" strokeWidth={1.5} />
      ) : (
        <Share2 className="size-5" strokeWidth={1.5} />
      )}
    </button>
  );
}
