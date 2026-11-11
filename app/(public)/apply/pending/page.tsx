import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { destinationFor } from "@/lib/auth-dispatch";
import { reviewReasons } from "@/lib/review-reasons";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/LogoutButton";

export const metadata: Metadata = { title: "Your application" };

export default async function PendingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("account_type, application_status")
      .eq("id", user.id)
      .maybeSingle();
    profile = data;

    // Approved pros and fans belong in their own app. Pending/rejected pros
    // resolve to this page, so there's no loop.
    const destination = destinationFor(profile);
    if (destination !== "/apply/pending") {
      redirect(destination);
    }
  }

  const rejected = profile?.application_status === "rejected";
  // The admin's reason, if they gave one (supabase/review-reasons.sql: only
  // the applicant and admins can read it).
  const reason =
    rejected && user
      ? (await reviewReasons(supabase, "profile", [user.id])).get(user.id)
      : undefined;

  // UX B-12 / B-33 / PX F15: this is now the ONE waiting screen (the Projects
  // gate sends pending pros here too). It uses the normal theme, makes no
  // promise of an email (none is sent yet), and its actions go somewhere real
  // instead of looping back to this page.
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <div className="max-w-xl">
        {rejected ? (
          <>
            <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              Your application wasn&rsquo;t approved.
            </h1>
            <p className="mt-5 text-lg text-muted-foreground text-balance">
              Thanks for applying to Action. We weren&rsquo;t able to approve
              your professional profile this time.
            </p>
            {reason && (
              <div className="mt-6 rounded-xl border border-border bg-muted/40 p-4 text-left">
                <p className="text-sm font-medium">From the reviewer</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                  {reason}
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              You&rsquo;re on the list.
            </h1>
            <p className="mt-5 text-lg text-muted-foreground text-balance">
              We review every application personally. A complete profile helps:
              add your role, a headline and your work. Once you&rsquo;re
              approved, signing in takes you straight into Action.
            </p>
          </>
        )}
        {user && (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {!rejected && (
              <Button asChild size="lg" className="h-11 px-6 text-base">
                <Link href="/profile">Complete your profile</Link>
              </Button>
            )}
            <LogoutButton className="inline-flex h-11 items-center gap-2 rounded-lg border border-border px-5 text-base font-medium transition-colors hover:bg-muted disabled:opacity-50" />
          </div>
        )}
      </div>
    </main>
  );
}
