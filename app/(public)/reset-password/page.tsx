"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { destinationFor } from "@/lib/auth-dispatch";
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

/** Same minimum as sign-up (Supabase's default). */
const MIN_PASSWORD_LENGTH = 6;

/**
 * Choose a new password. The reset link signed them in through /auth/callback,
 * so this page only needs a session; without one (an old tab, or opened
 * directly) it points back to /forgot-password.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setHasSession(!!data.user));
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error: updateError } = await supabase.auth.updateUser({
      password,
    });
    if (updateError || !data.user) {
      setError(
        updateError?.code === "same_password"
          ? "That's your current password. Choose a different one."
          : (updateError?.message ?? "Couldn't update your password. Try again.")
      );
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("account_type, application_status")
      .eq("id", data.user.id)
      .maybeSingle();
    router.refresh();
    router.push(destinationFor(profile));
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-20">
      <Card className="w-full max-w-md p-2">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            <h1>Choose a new password</h1>
          </CardTitle>
          <CardDescription>
            {hasSession === false
              ? "This page needs a fresh reset link."
              : "You’ll use it the next time you log in."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasSession === false ? (
            <div className="flex flex-col gap-4 text-center">
              <p className="text-sm text-muted-foreground">
                The link may have expired, or it was opened in a different
                browser.
              </p>
              <Button asChild size="lg" className="h-11 w-full text-base">
                <Link href="/forgot-password">Send a new link</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-describedby={error ? "new-password-error" : undefined}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  aria-describedby={error ? "new-password-error" : undefined}
                  required
                />
              </div>
              {error && (
                <p
                  id="new-password-error"
                  role="alert"
                  className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {error}
                </p>
              )}
              <Button
                type="submit"
                size="lg"
                disabled={loading || hasSession === null}
                className="mt-2 h-11 w-full text-base"
              >
                {loading ? "Saving…" : "Save new password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
