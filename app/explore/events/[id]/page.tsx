import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock, MapPin } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { resolveBackLink } from "@/lib/back-link";
import { titleCase } from "@/lib/marketplace";
import { eventTypeLabel } from "@/lib/content";
import { Avatar } from "@/components/Avatar";
import { RsvpButton } from "../rsvp-button";

// PUBLIC page — no shell, no auth redirect. Published events are open-access
// (RLS exposes published rows to anon), so logged-out fans can view them. We
// still fetch the viewer (if any) to allow the host/admin to preview a draft.

type Person = { display_name: string | null; role: string | null };

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Back-link target depends on the viewer: this page is public and shell-less,
  // and /explore (the Pro Explore tab) redirects any non-approved-pro away — so
  // sending a fan there bounces them to Pro home, and sending an anon there
  // forces a login on an open-access page. Approved pros → Pro Explore; fans →
  // the Fan app's Explore; logged-out → the landing page. This is the fallback:
  // when the viewer arrived from another in-app page we send them back there
  // instead (resolveBackLink, via the referer).
  let fallbackHref = "/";
  let fallbackLabel = "Back";
  if (user) {
    const { data: viewer } = await supabase
      .from("profiles")
      .select("account_type, application_status")
      .eq("id", user.id)
      .maybeSingle();
    if (
      viewer?.account_type === "professional" &&
      viewer?.application_status === "approved"
    ) {
      fallbackHref = "/explore";
      fallbackLabel = "Back to Explore";
    } else {
      fallbackHref = "/fan/events";
      fallbackLabel = "Back to events";
    }
  }
  const { href: backHref, label: backLabel } = await resolveBackLink(
    `/explore/events/${id}`,
    { href: fallbackHref, label: fallbackLabel }
  );

  const { data: event } = await supabase
    .from("events")
    .select(
      "id, title, description, venue, event_type, starts_at, status, created_by, host:profiles!events_created_by_fkey(display_name, role)"
    )
    .eq("id", id)
    .maybeSingle();

  if (!event) {
    notFound();
  }

  // Published is public. A non-published event is visible only to its host or an
  // admin (RLS already enforces this on read; this is the in-app echo).
  const isHost = !!user && event.created_by === user.id;
  let isAdmin = false;
  if (user && !isHost && event.status !== "published") {
    const { data: me } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();
    isAdmin = !!me?.is_admin;
  }
  if (event.status !== "published" && !isHost && !isAdmin) {
    notFound();
  }

  // Attendee count is public (view is readable by anon); the viewer's own RSVP
  // state only exists for a logged-in user.
  const { data: countRow } = await supabase
    .from("event_rsvp_counts")
    .select("rsvp_count")
    .eq("event_id", id)
    .maybeSingle();
  const rsvpCount = Number(countRow?.rsvp_count ?? 0);

  let hasRsvped = false;
  if (user) {
    const { data: myRsvp } = await supabase
      .from("event_rsvps")
      .select("id")
      .eq("event_id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    hasRsvped = !!myRsvp;
  }

  // Supabase types embedded relations as arrays; this FK is to-one at runtime.
  const host = event.host as unknown as Person | null;
  const hostName = host?.display_name || "the Action team";
  const starts = new Date(event.starts_at);
  const dateLine = starts.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeLine = starts.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
      <Link
        href={backHref}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {backLabel}
      </Link>

      <p className="text-sm font-medium text-brand">
        {eventTypeLabel(event.event_type)}
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
        {event.title}
      </h1>

      <div className="mt-6 flex flex-col gap-3 text-sm">
        <span className="inline-flex items-center gap-2">
          <CalendarDays className="size-4 text-brand" />
          {dateLine}
        </span>
        <span className="inline-flex items-center gap-2">
          <Clock className="size-4 text-brand" />
          {timeLine}
        </span>
        <span className="inline-flex items-center gap-2">
          <MapPin className="size-4 text-brand" />
          {event.venue || "Virtual"}
        </span>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Avatar name={hostName} className="size-9" />
        <p className="text-sm">
          <span className="text-muted-foreground">Hosted by </span>
          <span className="font-medium">{hostName}</span>
          {host?.role ? (
            <span className="text-muted-foreground">
              {" "}
              · {titleCase(host.role)}
            </span>
          ) : null}
        </p>
      </div>

      {event.description && (
        <p className="mt-8 whitespace-pre-wrap text-base leading-relaxed text-foreground/90">
          {event.description}
        </p>
      )}

      <div className="mt-8">
        <RsvpButton
          eventId={event.id}
          initialRsvped={hasRsvped}
          rsvpCount={rsvpCount}
          loggedIn={!!user}
          size="lg"
        />
      </div>
    </main>
  );
}
