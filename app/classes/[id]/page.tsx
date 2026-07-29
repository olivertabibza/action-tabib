import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  MapPin,
  Signal,
  Star,
  Users,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { disciplineLabel } from "@/lib/marketplace";
import { classLevelLabel, classFormatLabel, formatPrice } from "@/lib/content";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/Avatar";
import { EnrollButton } from "../enroll-button";
import { ReviewComposer } from "../review-composer";

// Gated + wrapped in ProShell by app/classes/layout.tsx (classes are pro-only),
// so — unlike the public event detail page — this page assumes an approved pro
// viewer and needs no anon/back-link handling.

type Person = { display_name: string | null; role: string | null };

type Review = {
  id: string;
  rating: number;
  body: string;
  created_at: string;
  reviewer_id: string;
  reviewer: Person | null;
};

/** Read-only 1–5 star row, filled up to `rating`. */
function RatingStars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            "size-3.5",
            n <= rating
              ? "fill-amber-500 text-amber-500"
              : "text-muted-foreground/40"
          )}
        />
      ))}
    </span>
  );
}

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: klass } = await supabase
    .from("classes")
    .select(
      "id, title, description, discipline, format, level, venue, price_cents, capacity, starts_at, status, created_by, instructor:profiles!classes_created_by_fkey(display_name, role)"
    )
    .eq("id", id)
    .maybeSingle();

  if (!klass) {
    notFound();
  }

  // Published is visible to any pro. A non-published class is visible only to
  // its instructor or an admin (RLS already enforces this on read; this is the
  // in-app echo).
  const isInstructor = !!user && klass.created_by === user.id;
  let isAdmin = false;
  if (user && !isInstructor && klass.status !== "published") {
    const { data: me } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();
    isAdmin = !!me?.is_admin;
  }
  if (klass.status !== "published" && !isInstructor && !isAdmin) {
    notFound();
  }

  // Seat count is public (view is readable by anon); the viewer's own enrollment
  // only exists for a logged-in user.
  const { data: countRow } = await supabase
    .from("class_enrollment_counts")
    .select("enrolled_count")
    .eq("class_id", id)
    .maybeSingle();
  const enrolledCount = Number(countRow?.enrolled_count ?? 0);
  const spotsLeft = Math.max(0, klass.capacity - enrolledCount);

  let isEnrolled = false;
  if (user) {
    const { data: mine } = await supabase
      .from("class_enrollments")
      .select("id")
      .eq("class_id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    isEnrolled = !!mine;
  }

  // Reviews, newest first, with each reviewer's profile embedded via the FK —
  // one query, no N+1. RLS scopes this to a published class (or your own row).
  const { data: reviewData } = await supabase
    .from("class_reviews")
    .select(
      "id, rating, body, created_at, reviewer_id, reviewer:profiles!class_reviews_reviewer_id_fkey(display_name, role)"
    )
    .eq("class_id", id)
    .order("created_at", { ascending: false });
  const reviews: Review[] = (reviewData ?? []).map((r) => ({
    ...r,
    reviewer: r.reviewer as unknown as Person | null,
  }));

  // "Reviews from your connections": the viewer's own follow rows are
  // self-readable, so fetch them and float followed reviewers to the top.
  // Each partition keeps the newest-first order from the query.
  let followedIds = new Set<string>();
  if (user && reviews.length > 0) {
    const { data: follows } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.id);
    followedIds = new Set((follows ?? []).map((f) => f.following_id as string));
  }
  const connectionReviews = reviews.filter((r) => followedIds.has(r.reviewer_id));
  const orderedReviews = [
    ...connectionReviews,
    ...reviews.filter((r) => !followedIds.has(r.reviewer_id)),
  ];

  const reviewCount = reviews.length;
  const avgRating =
    reviewCount > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
      : 0;
  const ownReview = user
    ? reviews.find((r) => r.reviewer_id === user.id) ?? null
    : null;

  // Supabase types embedded relations as arrays; this FK is to-one at runtime.
  const instructor = klass.instructor as unknown as Person | null;
  const instructorName = instructor?.display_name || "the Action team";
  const location =
    klass.format === "virtual" ? "Virtual" : klass.venue || "In person";
  const starts = new Date(klass.starts_at);
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
        href="/classes"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to Classes
      </Link>

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand">
          {disciplineLabel(klass.discipline)}
        </span>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {classLevelLabel(klass.level)}
        </span>
      </div>
      <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
        {klass.title}
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
          {location}
        </span>
        <span className="inline-flex items-center gap-2">
          <Signal className="size-4 text-brand" />
          {classFormatLabel(klass.format)}
        </span>
        <span className="inline-flex items-center gap-2">
          <Users className="size-4 text-brand" />
          {enrolledCount} of {klass.capacity} enrolled
        </span>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Avatar name={instructorName} className="size-9" />
        <p className="text-sm">
          <span className="text-muted-foreground">Taught by </span>
          <Link
            href={`/profile/${klass.created_by}`}
            className="font-medium hover:underline"
          >
            {instructorName}
          </Link>
          {instructor?.role ? (
            <span className="text-muted-foreground">
              {" "}
              · {disciplineLabel(instructor.role)}
            </span>
          ) : null}
        </p>
      </div>

      {/* Rating summary (the ★4.8 from the mockup) — hidden until the class has
          reviews. The full review list + composer live at the bottom of the
          page; this line keeps the headline number up here under the
          instructor. */}
      {reviewCount > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-sm">
          <Star className="size-4 fill-amber-500 text-amber-500" />
          <span className="font-semibold">{avgRating.toFixed(1)}</span>
          <span className="text-muted-foreground">
            ({reviewCount} {reviewCount === 1 ? "review" : "reviews"})
          </span>
        </p>
      )}

      <p className="mt-8 text-2xl font-bold">{formatPrice(klass.price_cents)}</p>

      {klass.description && (
        <p className="mt-6 whitespace-pre-wrap text-base leading-relaxed text-foreground/90">
          {klass.description}
        </p>
      )}

      <div className="mt-8 flex items-center gap-3">
        <EnrollButton
          classId={klass.id}
          initialEnrolled={isEnrolled}
          spotsLeft={spotsLeft}
          size="lg"
        />
        <span className="text-sm text-muted-foreground">
          {spotsLeft > 0
            ? `${spotsLeft} of ${klass.capacity} spots left`
            : "Class full"}
        </span>
      </div>

      {/* Reviews. Section only exists when there's something to show: a list,
          or the composer (enrolled viewers only — RLS backs that gate up). */}
      {(orderedReviews.length > 0 || isEnrolled) && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">
            {connectionReviews.length > 0
              ? "Reviews from your connections"
              : "Reviews"}
          </h2>

          {orderedReviews.length > 0 && (
            <ul className="mt-4 flex flex-col gap-5">
              {orderedReviews.map((r) => {
                const name = r.reviewer?.display_name || "A member";
                return (
                  <li key={r.id} className="flex items-start gap-3">
                    <Avatar name={name} className="size-9" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <Link
                          href={`/profile/${r.reviewer_id}`}
                          className="font-medium hover:underline"
                        >
                          {name}
                        </Link>
                        {r.reviewer?.role ? (
                          <span className="text-muted-foreground">
                            {" "}
                            · {disciplineLabel(r.reviewer.role)}
                          </span>
                        ) : null}
                      </p>
                      <div className="mt-1">
                        <RatingStars rating={r.rating} />
                      </div>
                      {r.body && (
                        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                          {r.body}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {isEnrolled && (
            <ReviewComposer
              classId={klass.id}
              initialRating={ownReview?.rating ?? null}
              initialBody={ownReview?.body ?? ""}
            />
          )}
        </section>
      )}
    </main>
  );
}
