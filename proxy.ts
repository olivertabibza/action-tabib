import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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
  const isProtected =
    pathname.startsWith("/home") || pathname.startsWith("/profile");
  const isAuthPage = pathname === "/login" || pathname === "/signup";

  // Logged-out users can't reach the app — send them to log in.
  if (!user && isProtected) {
    return redirectKeepingSession(request, response, "/login");
  }

  // Logged-in users shouldn't see the login/signup pages — send them home.
  if (user && isAuthPage) {
    return redirectKeepingSession(request, response, "/home");
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
