import Link from "next/link";
import { Newspaper } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Presentational pieces of the anon article meter (see proxy.ts for the cookie
 * and the [id] page for the gating decision). Server-rendered, no client JS.
 */

/** Slim banner over a logged-out reader's ONE free article. */
export function FreeArticleBanner() {
  return (
    <div className="mt-8 flex items-center gap-3 rounded-lg border border-brand/20 bg-brand/5 px-4 py-3 text-sm">
      <Newspaper className="size-4 shrink-0 text-brand" />
      <p className="min-w-0 flex-1 text-muted-foreground">
        You&rsquo;re reading your free article — join Action for unlimited
        access.
      </p>
      <Link
        href="/signup"
        className="shrink-0 font-medium text-brand hover:underline"
      >
        Join
      </Link>
    </div>
  );
}

/**
 * The gate under a truncated article. The two buttons reuse the landing page's
 * two signup destinations (hero CTAs in app/page.tsx) with a one-liner each.
 */
export function ArticleGateCard() {
  return (
    <div className="mt-2 rounded-xl border border-border bg-muted/50 p-6 text-center sm:p-8">
      <p className="text-xl font-bold tracking-tight">Log in to keep reading</p>
      <p className="mt-2 text-sm text-muted-foreground">
        You&rsquo;ve used your free article. Join Action to keep reading — and
        for everything else in the indie film community.
      </p>
      <div className="mx-auto mt-6 flex max-w-md flex-col gap-4">
        <div>
          <Button asChild className="w-full">
            <Link href="/signup?type=fan">Join as a Consumer</Link>
          </Button>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Open access — news, events, and rising filmmakers to follow.
          </p>
        </div>
        <div>
          <Button asChild variant="outline" className="w-full">
            <Link href="/signup?type=creator">
              Apply as an Industry Professional
            </Link>
          </Button>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Application required — the full toolkit for working creatives.
          </p>
        </div>
      </div>
      <p className="mt-5 text-sm text-muted-foreground">
        Already a member?{" "}
        <Link href="/login" className="font-medium text-brand hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
