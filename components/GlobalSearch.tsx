"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Avatar } from "@/components/Avatar";
import { Input } from "@/components/ui/input";
import { globalSearch, type SearchResult } from "@/app/search/actions";

/**
 * Grouped in this order so people come first — the same ordering the RPC
 * applies server-side. `href` builds the existing detail route per kind; all
 * five routes exist under app/ (profile/[id], projects/[id], classes/[id],
 * explore/events/[id], explore/articles/[id]).
 */
const GROUPS: {
  kind: SearchResult["kind"];
  label: string;
  href: (id: string) => string;
}[] = [
  { kind: "profile", label: "People", href: (id) => `/profile/${id}` },
  { kind: "project", label: "Projects", href: (id) => `/projects/${id}` },
  { kind: "class", label: "Classes", href: (id) => `/classes/${id}` },
  { kind: "event", label: "Events", href: (id) => `/explore/events/${id}` },
  {
    kind: "article",
    label: "Articles",
    href: (id) => `/explore/articles/${id}`,
  },
];

/**
 * Global search box, shared by Pro Explore and Fan Discover. It does NOT branch
 * on account type: public.global_search() already returns the right slice per
 * caller (pros additionally see projects/classes), so the same component renders
 * correctly on both surfaces.
 */
export function GlobalSearch({
  placeholder = "Search…",
  className,
}: {
  placeholder?: string;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  // The term the current `results` belong to — drives the empty state so we
  // don't flash "No results" against a stale or half-typed query.
  const [searchedTerm, setSearchedTerm] = useState("");
  const [pending, startTransition] = useTransition();
  // Monotonic request id: a slow response from an earlier keystroke must not
  // overwrite the results of a later one.
  const requestId = useRef(0);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      requestId.current += 1; // invalidate anything in flight
      setResults([]);
      setSearchedTerm("");
      return;
    }

    const timer = setTimeout(() => {
      const id = ++requestId.current;
      startTransition(async () => {
        const { results: rows } = await globalSearch(term);
        if (id !== requestId.current) return;
        setResults(rows);
        setSearchedTerm(term);
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  const showEmpty =
    !pending && searchedTerm.length >= 2 && results.length === 0;

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="pl-9"
        />
        {pending && (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {showEmpty && (
        <p className="mt-3 text-sm text-muted-foreground">
          No results for &ldquo;{searchedTerm}&rdquo;.
        </p>
      )}

      {results.length > 0 &&
        GROUPS.map(({ kind, label, href }) => {
          const rows = results.filter((r) => r.kind === kind);
          if (rows.length === 0) return null;
          return (
            <div key={kind} className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {label}
              </h3>
              <ul className="mt-2 flex flex-col gap-2">
                {rows.map((r) => (
                  <li key={`${r.kind}-${r.id}`}>
                    <Link
                      href={href(r.id)}
                      className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:border-brand"
                    >
                      {r.kind === "profile" && (
                        <Avatar name={r.title} className="size-8 text-xs" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          {r.title}
                        </span>
                        {r.subtitle && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {r.subtitle}
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
    </div>
  );
}
