/**
 * Single source of truth for "where does this logged-in user belong?".
 *
 * The rule used to be duplicated (and inconsistent) across proxy.ts, the root
 * page, the login page and every gated layout, which is how a non-approved pro
 * ended up in an infinite /dashboard → /home → / loop. Every one of those
 * callers now defers to this function.
 *
 * Only call it for a signed-in user. A user with no profile row (or one with
 * no account_type) never finished onboarding, so they go to /onboarding, which
 * is the only place a profile is created. /onboarding itself never redirects
 * back here for such a user, so there's no loop.
 *
 * Kept dependency-free on purpose so it can run in the proxy (edge), in server
 * components, and in the client login page alike.
 */
export type ProfileRouting = {
  account_type: string | null;
  application_status: string | null;
} | null;

export function destinationFor(profile: ProfileRouting): string {
  if (!profile?.account_type) {
    return "/onboarding";
  }

  if (profile?.account_type === "consumer") {
    return "/fan";
  }

  if (
    profile?.account_type === "professional" &&
    profile.application_status === "approved"
  ) {
    return "/dashboard";
  }

  // Pending/rejected pros, and anything unexpected (odd account_type or
  // status), park on the pending page rather than bouncing into the Pro app.
  return "/apply/pending";
}
