import Link from "next/link";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * How long a pending item has waited, from when it was submitted: "Waiting 5
 * hours", "Waiting 3 days". `now` comes from the page (new Date().getTime()).
 */
export function waitingLabel(submittedIso: string, now: number): string {
  const hours = Math.floor((now - new Date(submittedIso).getTime()) / 3_600_000);
  if (hours < 1) return "Waiting under an hour";
  if (hours < 24) return `Waiting ${hours} ${hours === 1 ? "hour" : "hours"}`;
  const days = Math.floor(hours / 24);
  return `Waiting ${days} ${days === 1 ? "day" : "days"}`;
}

/**
 * A free-text query goes into a PostgREST `or=(…)` filter string, where commas
 * and parentheses are syntax. Strip them rather than escape them (same rule
 * as /projects).
 */
export function sanitizeQuery(value: string | undefined): string {
  return (value ?? "").replace(/[,()\\"*%]/g, " ").trim().slice(0, 100);
}

/**
 * The queue's search box. A plain GET form, so the filter lives in the URL
 * (?q=, keeping ?status=) and is applied on the server; it works without
 * JavaScript.
 */
export function AdminSearch({
  action,
  status,
  q,
  placeholder,
}: {
  action: string;
  status: string;
  q: string;
  placeholder: string;
}) {
  return (
    <form action={action} method="get" role="search" className="mb-6 flex gap-2">
      {status !== "pending" && <input type="hidden" name="status" value={status} />}
      <label htmlFor="admin-q" className="sr-only">
        Search
      </label>
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="admin-q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder={placeholder}
          className="pl-8 max-sm:text-base"
        />
      </div>
      <Button type="submit" variant="outline">
        Search
      </Button>
      {q && (
        <Button asChild variant="ghost">
          <Link href={status === "pending" ? action : `${action}?status=${status}`}>
            Clear
          </Link>
        </Button>
      )}
    </form>
  );
}
