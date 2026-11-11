import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CalendarDays, Clapperboard, Newspaper } from "lucide-react";

import { SaveButton } from "./save-button";

/**
 * A member's saved events, articles and projects, newest-first. Shared by the
 * fan profile's Saved section and the pros' /profile/saved page (PX F03), so
 * both lists read and look the same.
 */

type ItemType = "event" | "article" | "project";
type SavedRow = { item_type: ItemType; item_id: string };

export type SavedEntry = {
  key: string;
  type: ItemType;
  id: string;
  href: string;
  title: string;
  subtitle: string;
};

// "Fri 12th": short weekday + ordinal day.
function formatSavedDate(iso: string, tz: string): string {
  const d = new Date(iso);
  const weekday = d.toLocaleDateString(undefined, {
    weekday: "short",
    timeZone: tz,
  });
  const day = Number(
    d.toLocaleDateString("en-US", { day: "numeric", timeZone: tz })
  );
  const suffix =
    day % 10 === 1 && day !== 11
      ? "st"
      : day % 10 === 2 && day !== 12
        ? "nd"
        : day % 10 === 3 && day !== 13
          ? "rd"
          : "th";
  return `${weekday} ${day}${suffix}`;
}

// Rough read time from body length at ~200 words/min, floored at 1 minute.
function readingMinutes(body: string | null): number {
  const words = (body ?? "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/**
 * The rows only carry item_type + item_id, so the titles come from one batched
 * query per type, stitched back in saved-at order. A save whose item is gone
 * or no longer visible (RLS) is dropped. RLS scopes saved_items to the caller.
 */
export async function loadSavedItems(
  supabase: SupabaseClient,
  userId: string,
  tz: string
): Promise<SavedEntry[]> {
  const { data: rows } = await supabase
    .from("saved_items")
    .select("item_type, item_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  const saved = (rows ?? []) as SavedRow[];

  const idsOf = (type: ItemType) =>
    saved.filter((s) => s.item_type === type).map((s) => s.item_id);
  const [eventIds, articleIds, projectIds] = [
    idsOf("event"),
    idsOf("article"),
    idsOf("project"),
  ];

  const [events, articles, projects] = await Promise.all([
    eventIds.length
      ? supabase.from("events").select("id, title, starts_at").in("id", eventIds)
      : null,
    articleIds.length
      ? supabase.from("articles").select("id, title, body").in("id", articleIds)
      : null,
    projectIds.length
      ? supabase
          .from("projects")
          .select("id, title, location, status")
          .in("id", projectIds)
      : null,
  ]);

  const eventById = new Map(
    ((events?.data ?? []) as { id: string; title: string; starts_at: string }[]).map(
      (e) => [e.id, e]
    )
  );
  const articleById = new Map(
    ((articles?.data ?? []) as { id: string; title: string; body: string | null }[]).map(
      (a) => [a.id, a]
    )
  );
  const projectById = new Map(
    (
      (projects?.data ?? []) as {
        id: string;
        title: string;
        location: string | null;
        status: string;
      }[]
    ).map((p) => [p.id, p])
  );

  return saved.flatMap((s): SavedEntry[] => {
    const base = { key: `${s.item_type}-${s.item_id}`, type: s.item_type, id: s.item_id };
    if (s.item_type === "event") {
      const e = eventById.get(s.item_id);
      return e
        ? [
            {
              ...base,
              href: `/explore/events/${s.item_id}`,
              title: e.title,
              subtitle: `Event · ${formatSavedDate(e.starts_at, tz)}`,
            },
          ]
        : [];
    }
    if (s.item_type === "article") {
      const a = articleById.get(s.item_id);
      return a
        ? [
            {
              ...base,
              href: `/explore/articles/${s.item_id}`,
              title: a.title,
              subtitle: `Article · ${readingMinutes(a.body)} min`,
            },
          ]
        : [];
    }
    const p = projectById.get(s.item_id);
    return p
      ? [
          {
            ...base,
            href: `/projects/${s.item_id}`,
            title: p.title,
            subtitle: [
              "Project",
              p.location?.trim() || null,
              p.status === "closed" ? "Closed" : null,
            ]
              .filter(Boolean)
              .join(" · "),
          },
        ]
      : [];
  });
}

const ICONS = {
  event: CalendarDays,
  article: Newspaper,
  project: Clapperboard,
} as const;

/** The list itself. Each row has its own bookmark so it can be removed here. */
export function SavedList({
  items,
  empty,
}: {
  items: SavedEntry[];
  empty: string;
}) {
  if (items.length === 0) {
    return <p className="mt-3 text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="mt-3 flex flex-col gap-3">
      {items.map((item) => {
        const Icon = ICONS[item.type];
        return (
          <li
            key={item.key}
            className="flex items-center gap-2 rounded-xl border border-border bg-card pr-2 transition-colors hover:border-brand"
          >
            <Link
              href={item.href}
              className="flex min-w-0 flex-1 items-center gap-4 rounded-xl p-4"
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted text-brand">
                <Icon className="size-5" strokeWidth={1.5} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold leading-snug">
                  {item.title}
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {item.subtitle}
                </span>
              </span>
            </Link>
            <SaveButton
              itemType={item.type}
              itemId={item.id}
              initialSaved
              variant="icon"
            />
          </li>
        );
      })}
    </ul>
  );
}
