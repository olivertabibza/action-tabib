import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Something went wrong" };

/**
 * Where an email link that couldn't be used lands. `?reason=reset` is a
 * password-reset link (app/(public)/auth/callback/route.ts).
 */
export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const isReset = reason === "reset";

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-24 text-center">
      <div className="max-w-md">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {isReset ? "That reset link didn’t work" : "Something went wrong"}
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          {isReset
            ? "It may have expired or already been used. Links also only work in the browser you asked from."
            : "We couldn’t confirm your account. The link may have expired or already been used."}
        </p>
      </div>
      <Button asChild size="lg" className="h-11 px-8 text-base">
        {isReset ? (
          <Link href="/forgot-password">Send a new link</Link>
        ) : (
          <Link href="/signup">Try signing up again</Link>
        )}
      </Button>
    </main>
  );
}
