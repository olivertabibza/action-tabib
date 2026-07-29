import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Plus, Users } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { titleCase } from "@/lib/marketplace";
import { ProjectCard } from "../project-card";

export default async function MyProjectsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // Projects I posted, with an applicant count via an embedded aggregate.
  const { data: posted } = await supabase
    .from("projects")
    .select(
      "id, title, disciplines, location, compensation, status, created_at, applications(count)"
    )
    .eq("created_by", user.id)
    .order("created_at", { ascending: false });

  // Projects I applied to, with the project embedded.
  const { data: applied } = await supabase
    .from("applications")
    .select(
      "id, status, created_at, project:projects(id, title, disciplines, location, compensation, status)"
    )
    .eq("applicant_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
      <Link
        href="/projects"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to projects
      </Link>

      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        My projects
      </h1>

      {/* Projects I posted */}
      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">Projects I posted</h2>
          <Button asChild size="sm">
            <Link href="/projects/new">
              <Plus className="size-4" />
              New
            </Link>
          </Button>
        </div>

        {posted && posted.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {posted.map((p) => {
              const count =
                (p.applications as { count: number }[] | null)?.[0]?.count ?? 0;
              return (
                <ProjectCard
                  key={p.id}
                  project={p}
                  meta={
                    <span className="inline-flex items-center gap-1.5 text-foreground/80">
                      <Users className="size-4 text-brand" />
                      {count} {count === 1 ? "applicant" : "applicants"}
                    </span>
                  }
                />
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            You haven&rsquo;t posted any projects yet.
          </p>
        )}
      </section>

      {/* Projects I applied to */}
      <section className="mt-12">
        <h2 className="mb-4 text-xl font-semibold">Projects I applied to</h2>

        {applied && applied.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {applied.map((a) => {
              const project = a.project as unknown as {
                id: string;
                title: string;
                status: string;
              } | null;
              if (!project) return null;
              return (
                <li key={a.id}>
                  <Link
                    href={`/projects/${project.id}`}
                    className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3 transition-colors hover:border-brand"
                  >
                    <span className="font-medium">{project.title}</span>
                    <span className="shrink-0 rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand">
                      {titleCase(a.status)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            You haven&rsquo;t applied to any projects yet.
          </p>
        )}
      </section>
    </main>
  );
}
