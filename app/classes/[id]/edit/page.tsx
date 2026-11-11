import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { utcToZoned, viewerTimeZone } from "@/lib/datetime";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ClassForm } from "../../class-form";
import type { ClassFormValues } from "../../schema";

export const metadata: Metadata = { title: "Edit class" };


// Access (auth + approved pro) and the ProShell come from app/classes/layout.tsx.
// On top of that, only the class's instructor may edit it.
export default async function EditClassPage({
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
      "id, title, description, discipline, format, level, venue, price_cents, capacity, starts_at, status, created_by"
    )
    .eq("id", id)
    .maybeSingle();

  if (!klass || !user || klass.created_by !== user.id) {
    notFound();
  }
  // A rejected class can't be resubmitted, so there's nothing to edit.
  if (klass.status === "rejected") {
    redirect(`/classes/${id}`);
  }

  const initialValues: ClassFormValues = {
    title: klass.title,
    discipline: klass.discipline,
    format: klass.format,
    level: klass.level,
    venue: klass.venue ?? "",
    price: klass.price_cents / 100,
    capacity: klass.capacity,
    // The inverse of createClass/updateClass (lib/datetime.ts): the same zone
    // in and out, so saving unchanged leaves starts_at unchanged.
    ...utcToZoned(klass.starts_at, await viewerTimeZone()),
    description: klass.description ?? "",
  };

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
      <Link
        href={`/classes/${id}`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to class
      </Link>

      <Card className="p-2">
        <CardHeader>
          <CardTitle className="text-2xl">Edit class</CardTitle>
          <CardDescription>
            {klass.status === "published"
              ? "Changes go live as soon as you save."
              : "Your class is still waiting for review."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ClassForm edit={{ classId: id, initialValues }} />
        </CardContent>
      </Card>
    </main>
  );
}
