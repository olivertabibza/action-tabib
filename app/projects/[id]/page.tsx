import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Clapperboard,
  CheckCircle2,
  ExternalLink,
  FileText,
  Lock,
  MapPin,
  UserRound,
  Wallet,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { signedPortfolioUrls, type PortfolioFile } from "@/lib/portfolio";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { disciplineLabel, roleQualifier, titleCase } from "@/lib/marketplace";
import { ApplyForm } from "./apply-form";
import { OwnerControls } from "./owner-controls";

type Person = { display_name: string | null; role: string | null };
type ProjectRole = {
  id: string;
  name: string;
  billing: string;
  gender: string;
  age_min: number | null;
  age_max: number | null;
  description: string;
  status: string;
};
type MyApplication = { id: string; status: string; role_id: string | null };
type Applicant = Person & {
  id: string;
  email: string | null;
  portfolio_files: string[] | null;
};

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ role?: string }>;
}) {
  const { id } = await params;
  const { role: roleParam } = await searchParams;
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

  // The production's open roles. RLS scopes project_roles to exactly the
  // audience of the parent project, so a plain select is the right read.
  const { data: roleRows } = await supabase
    .from("project_roles")
    .select("id, name, billing, gender, age_min, age_max, description, status")
    .eq("project_id", id)
    .order("sort_order", { ascending: true });
  const roles = (roleRows ?? []) as ProjectRole[];

  // ?role=<id> scopes the apply form to one role. Resolved against the roles we
  // already loaded, so an id belonging to another production simply doesn't
  // match and the page falls back to the whole-project apply path.
  const selectedRole = roleParam
    ? (roles.find((r) => r.id === roleParam) ?? null)
    : null;

  // The caller's own applications here, in ONE query serving both the
  // whole-project state and every role row's Applied pill — the applications
  // SELECT policy already returns the caller's own rows.
  let myApplications: MyApplication[] = [];
  if (!isOwner) {
    const { data } = await supabase
      .from("applications")
      .select("id, status, role_id")
      .eq("project_id", id)
      .eq("applicant_id", user.id);
    myApplications = (data ?? []) as MyApplication[];
  }
  const wholeApplication =
    myApplications.find((a) => a.role_id === null) ?? null;
  const appliedRoleIds = new Set(
    myApplications.filter((a) => a.role_id).map((a) => a.role_id as string)
  );

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
              {poster.role ? ` · ${disciplineLabel(poster.role)}` : ""}
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
        <span className="inline-flex items-start gap-2">
          <Clapperboard className="mt-0.5 size-4 shrink-0 text-brand" />
          <span className="flex flex-wrap gap-1.5">
            {((project.disciplines as string[]) ?? []).map((d) => (
              <span
                key={d}
                className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand"
              >
                {disciplineLabel(d)}
              </span>
            ))}
          </span>
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

      {roles.length > 0 && (
        <RolesCard
          projectId={project.id}
          roles={roles}
          isOwner={isOwner}
          isOpen={project.status === "open"}
          appliedRoleIds={appliedRoleIds}
          selectedRoleId={selectedRole?.id ?? null}
        />
      )}

      <div className="mt-8">
        {isOwner ? (
          <ApplicantsList projectId={project.id} />
        ) : (
          <ApplicantView
            projectId={project.id}
            isOpen={project.status === "open"}
            role={selectedRole}
            wholeApplication={wholeApplication}
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
      "id, note, status, created_at, role:project_roles(name), applicant:profiles!applications_applicant_id_fkey(id, display_name, role, email, portfolio_files)"
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  // Owner-only view: the "portfolios" bucket is PRIVATE, so mint short-lived
  // signed URLs for each applicant's files. Email + portfolios stay in here.
  const filesByApp = new Map<string, PortfolioFile[]>();
  for (const app of applications ?? []) {
    const applicant = app.applicant as unknown as Applicant | null;
    filesByApp.set(
      app.id,
      await signedPortfolioUrls(supabase, applicant?.portfolio_files)
    );
  }

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
              const applicant = app.applicant as unknown as Applicant | null;
              const appliedRole = app.role as unknown as { name: string } | null;
              const files = filesByApp.get(app.id) ?? [];
              return (
                <li
                  key={app.id}
                  className="rounded-lg border border-border p-4"
                >
                  <div className="flex items-center gap-2">
                    <UserRound className="size-4 text-brand" />
                    {applicant?.id ? (
                      <Link
                        href={`/profile/${applicant.id}`}
                        className="font-medium hover:underline"
                      >
                        {applicant.display_name || "A member"}
                      </Link>
                    ) : (
                      <span className="font-medium">
                        {applicant?.display_name || "A member"}
                      </span>
                    )}
                    {applicant?.role && (
                      <span className="text-sm text-muted-foreground">
                        · {disciplineLabel(applicant.role)}
                      </span>
                    )}
                  </div>
                  {applicant?.email && (
                    <a
                      href={`mailto:${applicant.email}`}
                      className="mt-1 inline-block text-sm text-brand hover:underline"
                    >
                      {applicant.email}
                    </a>
                  )}
                  <p className="mt-1 text-sm text-muted-foreground">
                    {appliedRole?.name
                      ? `Applied for: ${appliedRole.name}`
                      : "Applied to the whole production"}
                  </p>
                  {app.note && (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                      {app.note}
                    </p>
                  )}
                  <div className="mt-3">
                    <p className="mb-2 text-sm font-medium text-muted-foreground">
                      Portfolio
                    </p>
                    {files.length > 0 ? (
                      <ul className="flex flex-col gap-2">
                        {files.map((file) => (
                          <li key={file.url}>
                            <a
                              href={file.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm transition-colors hover:border-brand hover:bg-muted/50"
                            >
                              <FileText className="size-4 shrink-0 text-brand" />
                              <span className="truncate">{file.name}</span>
                              <ExternalLink className="ml-auto size-4 shrink-0 text-muted-foreground" />
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No portfolio files
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Roles on this production ──────────────────────────────────────────── */

/**
 * The roles rail's full list — where "+ N more roles →" on /projects lands.
 * Each open role links to ?role=<id>, which scopes the apply form below.
 */
function RolesCard({
  projectId,
  roles,
  isOwner,
  isOpen,
  appliedRoleIds,
  selectedRoleId,
}: {
  projectId: string;
  roles: ProjectRole[];
  isOwner: boolean;
  isOpen: boolean;
  appliedRoleIds: Set<string>;
  selectedRoleId: string | null;
}) {
  const open = roles.filter((r) => r.status === "open");

  return (
    <Card className="mt-8 p-2">
      <CardHeader>
        <CardTitle className="text-xl">Roles open ({open.length})</CardTitle>
        <CardDescription>
          Apply for a specific role, or use the form below to apply to the
          production as a whole.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3">
          {roles.map((role) => {
            const qualifier = roleQualifier(role);
            const applied = appliedRoleIds.has(role.id);
            return (
              <li
                key={role.id}
                className={`rounded-lg border p-4 ${
                  role.id === selectedRoleId ? "border-brand" : "border-border"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{role.name}</p>
                    {qualifier && (
                      <p className="text-sm text-muted-foreground">{qualifier}</p>
                    )}
                  </div>
                  {role.status !== "open" ? (
                    <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                      Filled
                    </span>
                  ) : applied ? (
                    <span className="shrink-0 rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand">
                      Applied
                    </span>
                  ) : (
                    !isOwner &&
                    isOpen && (
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/projects/${projectId}?role=${role.id}`}>
                          Apply
                        </Link>
                      </Button>
                    )
                  )}
                </div>
                {role.description && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                    {role.description}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

/* ── Non-owner: apply / already applied / closed ───────────────────────── */

async function ApplicantView({
  projectId,
  isOpen,
  role,
  wholeApplication,
}: {
  projectId: string;
  isOpen: boolean;
  role: ProjectRole | null;
  wholeApplication: MyApplication | null;
}) {
  // Role-scoped apply (?role=…). has_applied_to_role() is the security-definer
  // check the schema provides for exactly this state — one role, one call.
  if (role) {
    const supabase = await createClient();
    const { data: alreadyApplied } = await supabase.rpc("has_applied_to_role", {
      p_role_id: role.id,
    });

    if (alreadyApplied) {
      return (
        <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-4">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-brand" />
          <div>
            <p className="font-medium">
              You&rsquo;ve applied for {role.name}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              The poster will be in touch.
            </p>
          </div>
        </div>
      );
    }

    if (!isOpen || role.status !== "open") {
      return (
        <p className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          This role is no longer accepting applications.
        </p>
      );
    }

    return (
      <Card className="p-2">
        <CardHeader>
          <CardTitle className="text-xl">Apply for {role.name}</CardTitle>
          <CardDescription>
            {roleQualifier(role) ||
              "Send the poster a note to express your interest."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ApplyForm projectId={projectId} roleId={role.id} />
        </CardContent>
      </Card>
    );
  }

  // Whole-project apply — unchanged behaviour, and deliberately kept: role_id
  // is nullable so crew calls can go on using it.
  if (wholeApplication) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-4">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-brand" />
        <div>
          <p className="font-medium">You&rsquo;ve applied to this project</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Status: {titleCase(wholeApplication.status)}. The poster will be in
            touch.
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
