import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { destinationFor } from "@/lib/auth-dispatch";
import { createClient } from "@/lib/supabase/server";

/**
 * Live-event guest entry (supabase/demo-guests.sql). A QR code opens /demo:
 *   - already signed in (guest or member): go where they belong, no new account;
 *   - demo mode off: the landing page, and no account is created;
 *   - otherwise: an anonymous sign-in plus a profile, then /dashboard.
 * The profile's name, status and sample details are set by the database guard
 * (profiles_guard_privileged), so the insert below sends only the required
 * columns. email is NOT NULL and a guest has none.
 *
 * Guests always see the light theme: the demo_theme=light cookie set here is
 * read by the theme script in app/layout.tsx before first paint, whatever the
 * phone's dark-mode setting. It lasts 3 days, so it's gone soon after the
 * event, and guests get no theme switch (Nav, Profile).
 */
const DEMO_THEME_COOKIE = "demo_theme";

async function forceLightTheme() {
  (await cookies()).set(DEMO_THEME_COOKIE, "light", {
    path: "/",
    maxAge: 60 * 60 * 24 * 3,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: false, // the theme script has to read it
  });
}

export async function GET(request: NextRequest) {
  const { origin } = request.nextUrl;
  const go = (path: string) => NextResponse.redirect(`${origin}${path}`);
  const supabase = await createClient();

  let {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("account_type, application_status")
      .eq("id", user.id)
      .maybeSingle();
    // A guest whose profile insert failed last time gets one now, on the same
    // account (guests can't use /onboarding).
    if (profile || !user.is_anonymous) {
      if (user.is_anonymous) await forceLightTheme();
      return go(destinationFor(profile));
    }
  }

  const { data: demoOn } = await supabase.rpc("demo_mode_enabled");
  if (demoOn !== true) return go("/");

  if (!user) {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error || !data.user) {
      console.error("demo sign-in failed:", error?.message);
      return go("/");
    }
    user = data.user;
  }

  const { error } = await supabase
    .from("profiles")
    .insert({ id: user.id, email: "", account_type: "professional" });
  if (error) {
    // Don't leave a profile-less guest signed in: they can't onboard.
    console.error("demo profile failed:", error.message);
    await supabase.auth.signOut();
    return go("/");
  }

  await forceLightTheme();
  return go("/dashboard");
}
