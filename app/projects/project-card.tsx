import Link from "next/link";
import { Clapperboard, MapPin, Wallet } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { titleCase } from "@/lib/marketplace";

export type ProjectCardData = {
  id: string;
  title: string;
  discipline: string;
  location: string;
  compensation: string;
  status?: string;
};

/**
 * Summary card linking to a project's detail page. `meta` renders an optional
 * footer line (used on the "mine" page for applicant counts / status).
 */
export function ProjectCard({
  project,
  posterName,
  posterRole,
  meta,
}: {
  project: ProjectCardData;
  posterName?: string | null;
  posterRole?: string | null;
  meta?: React.ReactNode;
}) {
  return (
    <Link href={`/projects/${project.id}`} className="group">
      <Card className="h-full p-2 transition-colors group-hover:border-brand">
        <CardHeader>
          <CardTitle className="flex items-start justify-between gap-2 text-lg">
            <span>{project.title}</span>
            {project.status === "closed" && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                Closed
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <Clapperboard className="size-4 shrink-0 text-brand" />
            {project.discipline === "any"
              ? "Any discipline"
              : titleCase(project.discipline)}
          </span>
          <span className="inline-flex items-center gap-2">
            <MapPin className="size-4 shrink-0 text-brand" />
            {project.location || "—"}
          </span>
          <span className="inline-flex items-center gap-2">
            <Wallet className="size-4 shrink-0 text-brand" />
            {titleCase(project.compensation)}
          </span>
          {posterName && (
            <span className="mt-1 text-foreground/80">
              Posted by {posterName}
              {posterRole ? ` · ${titleCase(posterRole)}` : ""}
            </span>
          )}
          {meta && <div className="mt-1">{meta}</div>}
        </CardContent>
      </Card>
    </Link>
  );
}
