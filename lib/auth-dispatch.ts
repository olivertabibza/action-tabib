/**
 * Single source of truth for "where does this logged-in user belong?".
 *
 * The rule used to be duplicated (and inconsistent) across proxy.ts, the root
 * page, the login page and every gated layout, which is how a non-approved pro
 * ended up in an infinite /dashboard → /home → / loop. Every one of those
 * callers now defers to this function.
 *
 * Kept dependency-free on purpose so it can run in the proxy (edge), in server
 * components, and in the client login page alike.
 */
export type ProfileRouting = {
  account_type: string | null;
  application_status: string | null;
} | null;

export function destinationFor(profile: ProfileRouting): string {
  if (profile?.account_type === "consumer") {
    return "/fan";
  }

  if (
    profile?.account_type === "professional" &&
    profile.application_status === "approved"
  ) {
    return "/dashboard";
  }

  // Pending/rejected pros, and anything unexpected (missing profile, odd
  // status), park on the pending page rather than bouncing into the Pro app.
  return "/apply/pending";
}
