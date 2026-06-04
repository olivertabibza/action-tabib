import Link from "next/link";
import { FolderPlus, Plus } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ProjectsFilters } from "./projects-filters";
import { ProjectCard } from "./project-card";

type Poster = { display_name: string | null; role: string | null };

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ discipline?: string; location?: string }>;
}) {
  const { discipline = "", location = "" } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("projects")
    .select(
      "id, title, discipline, location, compensation, status, created_at, poster:profiles!projects_created_by_fkey(display_name, role)"
    )
    .eq("status", "open")
    .order("created_at", { ascending: false });

  // A discipline filter also surfaces "any discipline" projects.
  if (discipline) {
    query = query.in("discipline", [discipline, "any"]);
  }
  if (location) {
    query = query.ilike("location", `%${location}%`);
  }

  const { data: projects, error } = await query;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Projects
          </h1>
          <p className="mt-2 text-muted-foreground">
            Browse open roles, auditions, and collaborations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/projects/mine">My projects</Link>
          </Button>
          <Button asChild>
            <Link href="/projects/new">
              <Plus className="size-4" />
              Post a project
            </Link>
          </Button>
        </div>
      </div>

      <div className="mb-8">
        <ProjectsFilters discipline={discipline} location={location} />
      </div>

      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Couldn&rsquo;t load projects: {error.message}
        </p>
      )}

      {!error && projects && projects.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const poster = p.poster as unknown as Poster | null;
            return (
              <ProjectCard
                key={p.id}
                project={p}
                posterName={poster?.display_name}
                posterRole={poster?.role}
              />
            );
          })}
        </div>
      ) : (
        !error && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
            <FolderPlus className="size-8 text-muted-foreground" />
            <p className="font-medium">No projects match yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {discipline || location
                ? "Try clearing your filters, or be the first to post something here."
                : "Be the first to post a project for the community."}
            </p>
          </div>
        )
      )}
    </main>
  );
}
