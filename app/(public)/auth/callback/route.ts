import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import {
  AUTH_NEXT_COOKIE,
  RESET_PASSWORD_NEXT,
  RESET_PASSWORD_PATH,
} from "@/lib/auth-next";

/**
 * Auth callback: the code-exchange step after someone opens an email link.
 * Supabase redirects here with `?code=...`; we exchange it for a session (which
 * sets the auth cookies) and send them on: to /reset-password when they asked
 * for a reset link (lib/auth-next.ts), otherwise to /onboarding after a
 * sign-up confirmation.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const isReset =
    request.cookies.get(AUTH_NEXT_COOKIE)?.value === RESET_PASSWORD_NEXT;

  let response = NextResponse.redirect(
    `${origin}/auth/error${isReset ? "?reason=reset" : ""}`
  );

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      response = NextResponse.redirect(
        `${origin}${isReset ? RESET_PASSWORD_PATH : "/onboarding"}`
      );
    }
  }

  if (isReset) response.cookies.delete(AUTH_NEXT_COOKIE);
  return response;
}
