import Link from "next/link";
import { GraduationCap, Plus, Star } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { disciplineLabel } from "@/lib/marketplace";
import { classLevelLabel, classFormatLabel, formatPrice } from "@/lib/content";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// Access (auth + approved pro) is gated in app/classes/layout.tsx, which also
// renders the ProShell around this page. Classes are professional-only, so —
// unlike Explore's events/articles — there is no public detail page: the [id]
// page lives under this same gated layout.

type ClassRow = {
  id: string;
  title: string;
  discipline: string;
  format: string;
  level: string;
  venue: string;
  price_cents: number;
  capacity: number;
  starts_at: string;
  instructor: { display_name: string | null } | null;
};

// A pending/rejected class the current user authored.
type Submission = {
  id: string;
  title: string;
  status: "pending" | "rejected";
};

export default async function ClassesPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const { submitted } = await searchParams;
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Published, upcoming classes — soonest first. RLS exposes published rows, so
  // a normal server query is all that's needed.
  const { data: classData } = await supabase
    .from("classes")
    .select(
      "id, title, discipline, format, level, venue, price_cents, capacity, starts_at, instructor:profiles!classes_created_by_fkey(display_name)"
    )
    .eq("status", "published")
    .gte("starts_at", nowIso)
    .order("starts_at", { ascending: true });
  const classes = (classData ?? []).map((c) => ({
    ...c,
    instructor: c.instructor as unknown as { display_name: string | null } | null,
  })) as ClassRow[];

  // Enrolled head-counts for the "X of Y spots left" line. Counts are public via
  // the security-definer view; WHO enrolled stays private.
  const { data: countRows } = await supabase
    .from("class_enrollment_counts")
    .select("class_id, enrolled_count");
  const enrolledByClass = new Map<string, number>();
  for (const r of countRows ?? [])
    enrolledByClass.set(r.class_id as string, Number(r.enrolled_count));

  // Rating summaries for every listed class in ONE query (no per-card
  // queries), aggregated here — the cards show "★ 4.8 (12)" when a class has
  // reviews.
  const ratingByClass = new Map<string, { sum: number; count: number }>();
  if (classes.length > 0) {
    const { data: reviewRows } = await supabase
      .from("class_reviews")
      .select("class_id, rating")
      .in(
        "class_id",
        classes.map((c) => c.id)
      );
    for (const r of reviewRows ?? []) {
      const agg = ratingByClass.get(r.class_id as string) ?? { sum: 0, count: 0 };
      agg.sum += Number(r.rating);
      agg.count += 1;
      ratingByClass.set(r.class_id as string, agg);
    }
  }

  // The viewer's own not-yet-published submissions, so an author can track a
  // class they've sent for review (mirrors Explore's "Your submissions").
  const submissions: Submission[] = [];
  if (user) {
    const { data: mine } = await supabase
      .from("classes")
      .select("id, title, status, created_at")
      .eq("created_by", user.id)
      .in("status", ["pending", "rejected"])
      .order("created_at", { ascending: false });
    for (const c of mine ?? [])
      submissions.push({
        id: c.id,
        title: c.title,
        status: c.status as "pending" | "rejected",
      });
  }

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Classes</h1>
        {/* The whole page is gated to approved pros, so this is always shown. */}
        <Button asChild size="sm" variant="outline">
          <Link href="/classes/new">
            <Plus className="size-4" />
            Teach a class
          </Link>
        </Button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Workshops and classes taught by working pros.
      </p>

      {submitted === "class" && (
        <p className="mt-4 rounded-lg bg-brand/10 px-3 py-2 text-sm text-brand">
          Thanks — your class was submitted and is pending review. We&rsquo;ll
          publish it once it&rsquo;s approved.
        </p>
      )}

      {/* Your submissions (pending / rejected) */}
      {submissions.length > 0 && (
        <>
          <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Your submissions
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {submissions.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/classes/${s.id}`}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:border-brand"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {s.title}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                      s.status === "rejected"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {s.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Upcoming classes */}
      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Upcoming classes
      </h2>
      {classes.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-3">
          {classes.map((c) => (
            <li key={c.id}>
              <Link href={`/classes/${c.id}`} className="block">
                <ClassCard
                  klass={c}
                  spotsLeft={Math.max(
                    0,
                    c.capacity - (enrolledByClass.get(c.id) ?? 0)
                  )}
                  rating={ratingByClass.get(c.id) ?? null}
                />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-3 flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-12 text-center">
          <GraduationCap className="size-7 text-muted-foreground" />
          <p className="font-medium">No classes yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Workshops and classes from working pros will appear here once
            they&rsquo;re published.
          </p>
        </div>
      )}
    </main>
  );
}

function ClassCard({
  klass,
  spotsLeft,
  rating,
}: {
  klass: ClassRow;
  spotsLeft: number;
  rating: { sum: number; count: number } | null;
}) {
  const d = new Date(klass.starts_at);
  const month = d
    .toLocaleDateString(undefined, { month: "short" })
    .toUpperCase();
  const day = d.toLocaleDateString(undefined, { day: "numeric" });
  const instructor = klass.instructor?.display_name || "the Action team";
  const location =
    klass.format === "virtual" ? "Virtual" : klass.venue || "In person";

  return (
    <article className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-brand">
      <span className="flex size-14 shrink-0 flex-col items-center justify-center rounded-lg bg-brand/10 text-brand">
        <span className="text-[0.65rem] font-semibold uppercase tracking-wide">
          {month}
        </span>
        <span className="text-xl font-bold leading-none">{day}</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-snug">{klass.title}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-1 text-sm text-muted-foreground">
          {rating && (
            <>
              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                <Star className="size-3.5 fill-amber-500 text-amber-500" />
                {(rating.sum / rating.count).toFixed(1)} ({rating.count})
              </span>
              <span>·</span>
            </>
          )}
          <span>
            {instructor} · {location}
          </span>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
            {disciplineLabel(klass.discipline)}
          </span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {classLevelLabel(klass.level)}
          </span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {classFormatLabel(klass.format)}
          </span>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-semibold">{formatPrice(klass.price_cents)}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {spotsLeft > 0
            ? `${spotsLeft} of ${klass.capacity} spots left`
            : "Full"}
        </p>
      </div>
    </article>
  );
}
