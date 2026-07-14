import { headers } from "next/headers";

export type BackLink = { href: string; label: string };

/**
 * Resolve the back-link for a public, shell-less detail page. These pages are
 * reachable from many entry points, so a single fixed destination is usually
 * wrong. Prefer returning the viewer to wherever they actually came from (the
 * `referer`); fall back to the caller's account-aware default when the referer
 * can't be trusted.
 *
 * Guardrails: only a SAME-ORIGIN referer is ever used as a link target, and
 * only its relative path (pathname + search) — never an absolute URL, never an
 * off-site host. A referer that points back at the current page is ignored so
 * the button isn't a no-op.
 */
export async function resolveBackLink(
  currentPath: string,
  fallback: BackLink
): Promise<BackLink> {
  const h = await headers();
  const referer = h.get("referer");
  if (!referer) return fallback;

  let url: URL;
  try {
    url = new URL(referer);
  } catch {
    return fallback;
  }

  // Same-origin only: the referer host must match our own request host.
  const host = h.get("host");
  if (!host || url.host !== host) return fallback;

  // Don't loop back to the page we're already on.
  if (url.pathname === currentPath) return fallback;

  return { href: url.pathname + url.search, label: "Back" };
}
