import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  MapPin,
  Signal,
  Users,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { titleCase } from "@/lib/marketplace";
import { classLevelLabel, classFormatLabel, formatPrice } from "@/lib/content";
import { Avatar } from "@/components/Avatar";
import { EnrollButton } from "../enroll-button";

// Gated + wrapped in ProShell by app/classes/layout.tsx (classes are pro-only),
// so — unlike the public event detail page — this page assumes an approved pro
// viewer and needs no anon/back-link handling.

type Person = { display_name: string | null; role: string | null };

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
          {titleCase(klass.discipline)}
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
              · {titleCase(instructor.role)}
            </span>
          ) : null}
        </p>
      </div>

      {/* REVIEWS GO HERE — a ratings/reviews block (the ★4.8 in the mockup) is a
          later pass; deliberately not built now. Leave this gap under the header
          for it. */}

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
    </main>
  );
}
