"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/client";
import { AUTH_NEXT_COOKIE, RESET_PASSWORD_NEXT } from "@/lib/auth-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const RESEND_COOLDOWN_SECONDS = 30;

/**
 * Ask for a password-reset link (audit ENG F14, PX F14). The link comes back
 * through /auth/callback, which sends them to /reset-password because of the
 * cookie set here (lib/auth-next.ts). The confirmation never says whether an
 * account exists for the address.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  async function send(address: string) {
    setError(null);
    setLoading(true);
    // One hour, like the link itself.
    document.cookie = `${AUTH_NEXT_COOKIE}=${RESET_PASSWORD_NEXT}; Max-Age=3600; Path=/; SameSite=Lax`;
    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      address,
      { redirectTo: `${window.location.origin}/auth/callback` }
    );
    setLoading(false);
    if (resetError) {
      setError(
        resetError.status === 429
          ? "Too many reset emails were sent just now. Try again in a few minutes."
          : "We couldn’t send the email. Check the address and try again."
      );
      return;
    }
    setSentTo(address);
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void send(email.trim());
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-20">
      <Card className="w-full max-w-md p-2">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            <h1>Reset your password</h1>
          </CardTitle>
          <CardDescription>
            {sentTo
              ? "Check your inbox."
              : "Enter your email and we’ll send you a link to choose a new password."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sentTo ? (
            <div className="flex flex-col gap-4 text-center">
              <p className="text-sm text-muted-foreground">
                If there&rsquo;s an Action account for{" "}
                <span className="font-medium text-foreground">{sentTo}</span>,
                a reset link is on its way. Open it in this browser. It works
                for one hour.
              </p>
              {error && (
                <p
                  role="alert"
                  className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {error}
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                disabled={loading || cooldown > 0}
                onClick={() => void send(sentTo)}
                className="h-11 w-full text-base"
              >
                {cooldown > 0 ? `Send again in ${cooldown}s` : "Send it again"}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-describedby={error ? "reset-error" : undefined}
                  required
                />
              </div>
              {error && (
                <p
                  id="reset-error"
                  role="alert"
                  className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {error}
                </p>
              )}
              <Button
                type="submit"
                size="lg"
                disabled={loading}
                className="mt-2 h-11 w-full text-base"
              >
                {loading ? "Sending…" : "Send reset link"}
              </Button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Remembered it?{" "}
            <Link
              href="/login"
              className="font-medium text-brand transition-colors hover:underline"
            >
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
