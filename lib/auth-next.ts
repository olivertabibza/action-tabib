/**
 * Where the auth callback sends someone after a password-reset link.
 *
 * Reset links come back through /auth/callback, like sign-up confirmations,
 * which send people on to /onboarding. The request page sets this short-lived
 * cookie so the callback knows it's a reset instead. (The code exchange already
 * needs the same browser that asked, so a cookie costs nothing extra, and it
 * means no new redirect URL to allow in Supabase.) Only this one known value
 * is honoured, so the cookie can never redirect anywhere else.
 */
export const AUTH_NEXT_COOKIE = "auth_next";
export const RESET_PASSWORD_NEXT = "reset-password";
export const RESET_PASSWORD_PATH = "/reset-password";
