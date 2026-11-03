"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Shared fallback for the route-level error.tsx files. Pages throw when a load
 * fails, so people see "couldn't load" instead of an empty state that wrongly
 * says there's nothing there. Placed per segment (app/messages/error.tsx etc.)
 * it renders inside that segment's layout, so the app shell and nav stay.
 *
 * `retry` is this Next.js version's name for the boundary's re-render callback
 * (see node_modules/next/dist/docs/.../file-conventions/error.md).
 */
export default function RouteError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <AlertTriangle className="size-8 text-destructive" strokeWidth={1.5} />
      <h1 className="text-xl font-semibold">Couldn&rsquo;t load this page</h1>
      <p className="text-sm text-muted-foreground">
        Something went wrong on our side. Try again, and if it keeps happening,
        check back in a few minutes.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Button type="button" onClick={() => retry()}>
          Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </main>
  );
}
