import Link from "next/link";
import { Users } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { titleCase } from "@/lib/marketplace";
import { ProjectCard } from "./project-card";

/**
 * The Projects page's "My postings" and "Applications" tabs (UX B-06, PX F01,
 * F02). They used to share one /projects/mine page that most people never
 * found. Failed loads throw to app/projects/error.tsx rather than reading as
 * "You haven't … yet."
 */

export async function MyPostings({ userId }: { userId: string }) {
  const supabase = await createClient();
  // Projects I posted, with an applicant count via an embedded aggregate.
  const { data: posted, error } = await supabase
    .from("projects")
    .select(
      "id, title, disciplines, location, compensation, status, created_at, applications(count)"
    )
    .eq("created_by", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`My projects load failed: ${error.message}`);

  return (
    <section>
      {posted && posted.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posted.map((p) => {
            const count =
              (p.applications as { count: number }[] | null)?.[0]?.count ?? 0;
            return (
              <ProjectCard
                key={p.id}
                project={p}
                // With applicants, the card opens straight on them (PX F08).
                href={count > 0 ? `/projects/${p.id}#applicants` : undefined}
                meta={
                  <span className="inline-flex items-center gap-1.5 text-foreground/80">
                    <Users className="size-4 text-brand" />
                    {count} {count === 1 ? "applicant" : "applicants"}
                    {count > 0 && (
                      <span className="font-medium text-brand">· Review</span>
                    )}
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
  );
}

export async function MyApplications({ userId }: { userId: string }) {
  const supabase = await createClient();
  // Projects I applied to, with the project embedded.
  const { data: applied, error } = await supabase
    .from("applications")
    .select(
      "id, status, created_at, project:projects(id, title, disciplines, location, compensation, status), role:project_roles(name)"
    )
    .eq("applicant_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`My applications load failed: ${error.message}`);

  return (
    <section>
      {applied && applied.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {applied.map((a) => {
            const project = a.project as unknown as {
              id: string;
              title: string;
              status: string;
            } | null;
            if (!project) return null;
            // Two roles on one production read as two identical rows
            // without the role's name.
            const role = a.role as unknown as { name: string } | null;
            return (
              <li key={a.id}>
                <Link
                  href={`/projects/${project.id}`}
                  className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3 transition-colors hover:border-brand"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {project.title}
                    </span>
                    {role && (
                      <span className="block truncate text-sm text-muted-foreground">
                        {role.name}
                      </span>
                    )}
                  </span>
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
  );
}

/** Tab badges: how many postings and applications the viewer has. */
export async function myProjectCounts(userId: string) {
  const supabase = await createClient();
  const [posted, applied] = await Promise.all([
    supabase
      .from("projects")
      .select("*", { count: "exact", head: true })
      .eq("created_by", userId),
    supabase
      .from("applications")
      .select("*", { count: "exact", head: true })
      .eq("applicant_id", userId),
  ]);
  return { postings: posted.count ?? 0, applications: applied.count ?? 0 };
}
