import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Clapperboard,
  CheckCircle2,
  Lock,
  MapPin,
  UserRound,
  Wallet,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { titleCase } from "@/lib/marketplace";
import { ApplyForm } from "./apply-form";
import { OwnerControls } from "./owner-controls";

type Person = { display_name: string | null; role: string | null };

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: project } = await supabase
    .from("projects")
    .select(
      "*, poster:profiles!projects_created_by_fkey(display_name, role)"
    )
    .eq("id", id)
    .maybeSingle();

  if (!project) {
    notFound();
  }

  const isOwner = project.created_by === user.id;
  // Supabase types embedded relations as arrays; this FK is to-one at runtime.
  const poster = project.poster as unknown as Person | null;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
      <Link
        href="/projects"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to projects
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {project.title}
          </h1>
          {poster && (
            <p className="mt-2 text-muted-foreground">
              Posted by {poster.display_name || "A member"}
              {poster.role ? ` · ${titleCase(poster.role)}` : ""}
            </p>
          )}
        </div>
        {project.status === "closed" && !isOwner && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
            <Lock className="size-3.5" />
            Closed
          </span>
        )}
        {isOwner && (
          <OwnerControls projectId={project.id} status={project.status} />
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <Clapperboard className="size-4 text-brand" />
          {project.discipline === "any"
            ? "Any discipline"
            : titleCase(project.discipline)}
        </span>
        <span className="inline-flex items-center gap-2">
          <MapPin className="size-4 text-brand" />
          {project.location || "—"}
        </span>
        <span className="inline-flex items-center gap-2">
          <Wallet className="size-4 text-brand" />
          {titleCase(project.compensation)}
        </span>
      </div>

      <Card className="mt-8 p-2">
        <CardHeader>
          <CardTitle className="text-xl">About this project</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {project.description || "No description provided."}
          </p>
        </CardContent>
      </Card>

      <div className="mt-8">
        {isOwner ? (
          <ApplicantsList projectId={project.id} />
        ) : (
          <ApplicantView
            projectId={project.id}
            isOpen={project.status === "open"}
            userId={user.id}
          />
        )}
      </div>
    </main>
  );
}

/* ── Owner: applicants ─────────────────────────────────────────────────── */

async function ApplicantsList({ projectId }: { projectId: string }) {
  const supabase = await createClient();
  const { data: applications } = await supabase
    .from("applications")
    .select(
      "id, note, status, created_at, applicant:profiles!applications_applicant_id_fkey(display_name, role)"
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  const count = applications?.length ?? 0;

  return (
    <Card className="p-2">
      <CardHeader>
        <CardTitle className="text-xl">
          Applicants {count > 0 && `(${count})`}
        </CardTitle>
        <CardDescription>
          Everyone who has applied to this project.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {count === 0 ? (
          <p className="text-sm text-muted-foreground">No applications yet.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {applications!.map((app) => {
              const applicant = app.applicant as unknown as Person | null;
              return (
                <li
                  key={app.id}
                  className="rounded-lg border border-border p-4"
                >
                  <div className="flex items-center gap-2">
                    <UserRound className="size-4 text-brand" />
                    <span className="font-medium">
                      {applicant?.display_name || "A member"}
                    </span>
                    {applicant?.role && (
                      <span className="text-sm text-muted-foreground">
                        · {titleCase(applicant.role)}
                      </span>
                    )}
                  </div>
                  {app.note && (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                      {app.note}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Non-owner: apply / already applied / closed ───────────────────────── */

async function ApplicantView({
  projectId,
  isOpen,
  userId,
}: {
  projectId: string;
  isOpen: boolean;
  userId: string;
}) {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("applications")
    .select("id, status")
    .eq("project_id", projectId)
    .eq("applicant_id", userId)
    .maybeSingle();

  if (existing) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-4">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-brand" />
        <div>
          <p className="font-medium">You&rsquo;ve applied to this project</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Status: {titleCase(existing.status)}. The poster will be in touch.
          </p>
        </div>
      </div>
    );
  }

  if (!isOpen) {
    return (
      <p className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        This project is closed and is no longer accepting applications.
      </p>
    );
  }

  return (
    <Card className="p-2">
      <CardHeader>
        <CardTitle className="text-xl">Apply</CardTitle>
        <CardDescription>
          Send the poster a note to express your interest.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ApplyForm projectId={projectId} />
      </CardContent>
    </Card>
  );
}
