import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { destinationFor } from "@/lib/auth-dispatch";

/**
 * Proxy — Next.js 16's replacement for Middleware (same functionality, renamed
 * in v16). Runs before every matched request and refreshes the user's Supabase
 * session so server-rendered routes always see fresh auth cookies.
 *
 * Follows the standard Supabase SSR pattern: read cookies from the request,
 * write any refreshed cookies onto both the request and the response.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: do not run code between createServerClient and getUser(). A
  // simple mistake here can make it very hard to debug random logout issues.
  // getUser() revalidates the token and triggers the cookie refresh above.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // NYT-style article meter, anon readers only: the FIRST article a logged-out
  // visitor opens becomes their one free article. The cookie stores WHICH
  // article (not a count), so revisiting it stays free; the article page gates
  // every other id. It's set here, not in the page, because server components
  // can't write cookies during render. Same dual-write as the Supabase pattern
  // above: mutate the request cookies and rebuild the response around the
  // mutated request (carrying over any auth cookies getUser() refreshed onto
  // the old response), so the server component rendering THIS request already
  // sees the cookie. "/explore/articles/new" is the submission form, not an
  // article — never meter it.
  const articleId = pathname.match(/^\/explore\/articles\/([^/]+)$/)?.[1];
  if (!user && articleId && articleId !== "new") {
    if (!request.cookies.get("article_meter")) {
      request.cookies.set("article_meter", articleId);
      const refreshed = response.cookies.getAll();
      response = NextResponse.next({ request });
      refreshed.forEach((cookie) => response.cookies.set(cookie));
      response.cookies.set("article_meter", articleId, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, // ~30 days
        path: "/",
      });
    }
  }

  // /profile (own editable profile) is protected, but /profile/<id> is a
  // public read-only view of an approved professional — leave it open.
  const isProtected =
    pathname.startsWith("/fan") ||
    pathname === "/profile" ||
    pathname.startsWith("/projects") ||
    pathname.startsWith("/admin");
  const isAuthPage = pathname === "/login" || pathname === "/signup";

  // Logged-out users can't reach the app — send them to log in.
  if (!user && isProtected) {
    return redirectKeepingSession(request, response, "/login");
  }

  // Logged-in users shouldn't see the login/signup pages — send them straight
  // into their app. destinationFor (lib/auth-dispatch.ts) owns that rule:
  // consumers → /fan, approved pros → /dashboard, everyone else (pending or
  // rejected pros, missing profile) → /apply/pending. The profiles query is
  // guarded to this branch so it only runs on the auth-page redirect, never on
  // every request.
  if (user && isAuthPage) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("account_type, application_status")
      .eq("id", user.id)
      .maybeSingle();
    return redirectKeepingSession(request, response, destinationFor(profile));
  }

  return response;
}

/**
 * Redirect while preserving any auth cookies that getUser() refreshed onto
 * `response`. Skipping this can drop a freshly-rotated session and cause
 * intermittent logouts.
 */
function redirectKeepingSession(
  request: NextRequest,
  response: NextResponse,
  pathname: string
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  const redirectResponse = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });
  return redirectResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico
     * - common image/asset extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
