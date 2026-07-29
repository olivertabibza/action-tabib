import { FolderOpen } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { disciplineLabel } from "@/lib/marketplace";
import { cn } from "@/lib/utils";
import { AdminNav } from "../admin-nav";
import { CloseButton } from "./close-button";

type Owner = { display_name: string | null };

export default async function AdminProjectsPage() {
  const supabase = await createClient();

  const { data: projects, error } = await supabase
    .from("projects")
    .select(
      "id, title, disciplines, status, created_at, owner:profiles!projects_created_by_fkey(display_name)"
    )
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Admin</h1>
      <p className="mt-2 text-muted-foreground">Moderate project listings.</p>

      <div className="mt-8">
        <AdminNav active="projects" />
      </div>

      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Couldn&rsquo;t load projects: {error.message}
        </p>
      )}

      {!error && projects && projects.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {projects.map((p) => {
            const owner = p.owner as unknown as Owner | null;
            const created = new Date(p.created_at).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            });
            return (
              <li
                key={p.id}
                className="flex flex-wrap items-center gap-4 rounded-lg border border-border px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{p.title}</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                        p.status === "open"
                          ? "bg-brand/10 text-brand"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {p.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {(p.disciplines as string[]).map(disciplineLabel).join(", ")}{" "}
                    · {owner?.display_name || "Unknown owner"} · {created}
                  </p>
                </div>
                {p.status === "open" && <CloseButton projectId={p.id} />}
              </li>
            );
          })}
        </ul>
      ) : (
        !error && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
            <FolderOpen className="size-8 text-muted-foreground" />
            <p className="font-medium">No projects yet</p>
          </div>
        )
      )}
    </main>
  );
}
