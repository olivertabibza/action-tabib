"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
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

type Status = "form" | "check-email" | "account-exists";

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status>("form");
  const [cooldown, setCooldown] = useState(0);
  const [resent, setResent] = useState(false);

  // Tick the resend cooldown down to zero so the button can't be spammed.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // No session means email confirmation is on: the account isn't usable yet,
    // so pushing to /onboarding would bounce straight back to /signup with no
    // explanation. Stay put and tell them to go check their inbox.
    if (!data.session) {
      setLoading(false);

      // Supabase doesn't error on an already-registered address — it returns an
      // obfuscated user with no identities, so signup can't be used to probe
      // which emails have accounts.
      if (data.user?.identities?.length === 0) {
        setStatus("account-exists");
        return;
      }

      setCooldown(RESEND_COOLDOWN_SECONDS);
      setStatus("check-email");
      return;
    }

    // Confirmation is off, so signUp auto-signed us in. Refresh so server
    // components re-read the auth cookie and don't render a stale logged-out UI.
    router.refresh();
    router.push("/onboarding");
  }

  async function handleResend() {
    setError(null);
    setResent(false);
    setLoading(true);

    const supabase = createClient();
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);

    if (resendError) {
      setError(resendError.message);
      return;
    }

    setResent(true);
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-20">
      <Card className="w-full max-w-md p-2">
        {status === "check-email" ? (
          <>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Check your email</CardTitle>
              <CardDescription>
                We sent a confirmation link to{" "}
                <span className="font-medium text-text-primary">{email}</span>.
                Click it to finish setting up your account.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-center text-sm text-muted-foreground">
                No email yet? Check your spam folder, or send it again.
              </p>

              {error && (
                <p
                  role="alert"
                  className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {error}
                </p>
              )}

              {resent && !error && (
                <p
                  role="status"
                  className="mt-4 rounded-lg bg-surface-sunken px-3 py-2 text-center text-sm text-muted-foreground"
                >
                  Confirmation email sent again.
                </p>
              )}

              <Button
                type="button"
                size="lg"
                variant="outline"
                onClick={handleResend}
                disabled={loading || cooldown > 0}
                className="mt-4 h-11 w-full text-base"
              >
                {loading
                  ? "Sending…"
                  : cooldown > 0
                    ? `Resend email (${cooldown}s)`
                    : "Resend email"}
              </Button>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                Already confirmed?{" "}
                <Link
                  href="/login"
                  className="font-medium text-brand transition-colors hover:underline"
                >
                  Log in
                </Link>
              </p>
            </CardContent>
          </>
        ) : status === "account-exists" ? (
          <>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">
                An account with this email already exists
              </CardTitle>
              <CardDescription>
                <span className="font-medium text-text-primary">{email}</span> is
                already registered on Action.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild size="lg" className="h-11 w-full text-base">
                <Link href="/login">Log in instead</Link>
              </Button>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                Wrong address?{" "}
                <button
                  type="button"
                  onClick={() => setStatus("form")}
                  className="font-medium text-brand transition-colors hover:underline"
                >
                  Sign up with a different email
                </button>
              </p>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Create your account</CardTitle>
              <CardDescription>
                Join the network where the next generation of film gets made.
              </CardDescription>
            </CardHeader>
            <CardContent>
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
                    required
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="confirm-password">Confirm password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>

                {error && (
                  <p
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
                  {loading ? "Creating account…" : "Sign up"}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="font-medium text-brand transition-colors hover:underline"
                >
                  Log in
                </Link>
              </p>
            </CardContent>
          </>
        )}
      </Card>
    </main>
  );
}
