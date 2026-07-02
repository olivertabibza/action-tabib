// Fan Events tab — upcoming published screenings & Q&As to attend, matched to
// fan-events.png. Events come from the SAME table pros publish to (published
// rows are readable here); RSVPs are per-viewer. The Fan layout already gates
// this to a logged-in consumer, so there is always a user to read RSVPs for.
import Link from "next/link";
import { Clock, MapPin } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { eventTypeLabel } from "@/lib/content";
import { RsvpButton } from "@/app/explore/events/rsvp-button";
import { Button } from "@/components/ui/button";

type EventRow = {
  id: string;
  title: string;
  venue: string;
  event_type: string;
  starts_at: string;
};

export default async function FanEventsPage() {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: eventData } = await supabase
    .from("events")
    .select("id, title, venue, event_type, starts_at")
    .eq("status", "published")
    .gte("starts_at", nowIso)
    .order("starts_at", { ascending: true });
  const events = (eventData ?? []) as EventRow[];

  // Which of these events the viewer has already RSVPed to (one query).
  const rsvpedIds = new Set<string>();
  if (user && events.length > 0) {
    const { data: myRsvps } = await supabase
      .from("event_rsvps")
      .select("event_id")
      .eq("user_id", user.id)
      .in(
        "event_id",
        events.map((e) => e.id)
      );
    for (const r of myRsvps ?? []) rsvpedIds.add(r.event_id);
  }

  // Public attendee counts for the listed events (one query).
  const counts = new Map<string, number>();
  if (events.length > 0) {
    const { data: countRows } = await supabase
      .from("event_rsvp_counts")
      .select("event_id, rsvp_count")
      .in(
        "event_id",
        events.map((e) => e.id)
      );
    for (const c of countRows ?? []) counts.set(c.event_id, Number(c.rsvp_count));
  }

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <h1 className="text-2xl font-bold tracking-tight">Events</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Screenings, Q&amp;As, and mixers to attend.
      </p>

      {events.length > 0 ? (
        <ul className="mt-6 flex flex-col gap-3">
          {events.map((e) => {
            const d = new Date(e.starts_at);
            const month = d
              .toLocaleDateString(undefined, { month: "short" })
              .toUpperCase();
            const day = d.toLocaleDateString(undefined, { day: "numeric" });
            const time = d.toLocaleTimeString(undefined, {
              hour: "numeric",
              minute: "2-digit",
            });
            return (
              <li
                key={e.id}
                className="flex gap-4 rounded-xl border border-border bg-card p-4"
              >
                <span className="flex size-14 shrink-0 flex-col items-center justify-center rounded-lg bg-brand/10 text-brand">
                  <span className="text-[0.65rem] font-semibold uppercase tracking-wide">
                    {month}
                  </span>
                  <span className="text-xl font-bold leading-none">{day}</span>
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-brand">
                    {eventTypeLabel(e.event_type)}
                  </p>
                  <p className="mt-0.5 font-semibold leading-snug">{e.title}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3.5" />
                      {time}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5" />
                      {e.venue || "Virtual"}
                    </span>
                  </p>

                  <div className="mt-3 flex items-center gap-2">
                    <RsvpButton
                      eventId={e.id}
                      initialRsvped={rsvpedIds.has(e.id)}
                      rsvpCount={counts.get(e.id) ?? 0}
                      size="sm"
                    />
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/explore/events/${e.id}`}>Details</Link>
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">
          No upcoming events yet — check back soon.
        </p>
      )}
    </main>
  );
}
