import Link from "next/link";
import { Newspaper } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Presentational pieces of the anon article meter (see stampArticleMeter in
 * actions.ts for the cookie and the [id] page for the gating decision).
 * Server-rendered, no client JS.
 */

/** Slim banner over a logged-out reader's ONE free article. */
export function FreeArticleBanner() {
  return (
    <div className="mt-8 flex items-center gap-3 rounded-lg border border-brand/20 bg-brand/5 px-4 py-3 text-sm">
      <Newspaper className="size-4 shrink-0 text-brand" />
      <p className="min-w-0 flex-1 text-muted-foreground">
        This one&rsquo;s on us. Join Action to read every article.
      </p>
      <Link
        href="/signup?type=fan"
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
      <h2 className="text-xl font-bold tracking-tight">
        Join Action to keep reading
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        You&rsquo;ve read your free article. A free fan account gets you every
        article, plus events and filmmakers to follow.
      </p>
      <div className="mx-auto mt-6 flex max-w-md flex-col gap-4">
        <div>
          <Button asChild className="w-full">
            <Link href="/signup?type=fan">Join as a Fan</Link>
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
          Log in
        </Link>
      </p>
    </div>
  );
}
