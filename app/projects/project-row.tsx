import Link from "next/link";
import { Clock, MapPin, Star, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { Avatar } from "@/components/Avatar";
import { CallboardCard } from "@/components/CallboardCard";
import { SaveButton } from "@/app/explore/saved/save-button";
import {
  disciplineLabel,
  formatPayRange,
  projectTypeLabel,
  roleQualifier,
} from "@/lib/marketplace";
import { ShareButton } from "./share-button";

export type Poster = { display_name: string | null; role: string | null };

export type ProjectRowData = {
  id: string;
  title: string;
  description: string;
  location: string;
  project_type: string;
  pay_min: number | null;
  pay_max: number | null;
  pay_unit: string | null;
  tags: string[] | null;
  staff_pick: boolean;
  posted_at: string;
  poster: Poster | null;
};

export type RoleRow = {
  id: string;
  project_id: string;
  name: string;
  billing: string;
  gender: string;
  age_min: number | null;
  age_max: number | null;
};

/** How many role rows the rail shows before "+ N more roles →". */
const RAIL_ROLES = 3;

/**
 * The design's project split card (design/handoff/README.md §2): a flexible
 * left column and a fixed 290px tinted roles rail. Below 640px (§4) the rail
 * stops being a side panel and becomes a tinted block at the foot of the card.
 */
export function ProjectRow({
  project,
  roles,
  circleApplied,
  saved,
  appliedRoleIds,
}: {
  project: ProjectRowData;
  roles: RoleRow[];
  circleApplied: number;
  saved: boolean;
  appliedRoleIds: Set<string>;
}) {
  const href = `/projects/${project.id}`;
  const pay = formatPayRange(project.pay_min, project.pay_max, project.pay_unit);
  const posted = new Date(project.posted_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  return (
    <CallboardCard
      className={cn(
        "flex items-stretch max-sm:flex-col",
        // Featured row: accent border plus the 0 0 0 1.5px ring, composed on
        // top of the standard card shadow.
        project.staff_pick && "border-accent ring-[1.5px] ring-accent"
      )}
    >
      {/* ── Left column ─────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col px-[22px] pb-[18px] pt-5 max-sm:px-4 max-sm:py-4">
        <div className="flex flex-wrap items-center gap-2">
          {project.staff_pick && (
            <StatusChip tone="accent">
              <Star className="size-3 fill-current" strokeWidth={1.5} />
              Staff pick
            </StatusChip>
          )}
          <StatusChip tone="muted">{projectTypeLabel(project.project_type)}</StatusChip>
          <StatusChip tone="success">Open</StatusChip>
        </div>

        <div className="mt-2.5 flex items-start justify-between gap-3">
          <h2 className="min-w-0">
            <Link
              href={href}
              className="focus-ring font-condensed text-[27px] font-semibold leading-[1.1] text-text-primary transition-colors hover:text-accent max-sm:text-[26px]"
            >
              {project.title}
            </Link>
          </h2>
          <div className="flex shrink-0 items-center gap-1">
            <SaveButton
              variant="icon"
              itemType="project"
              itemId={project.id}
              initialSaved={saved}
            />
            <ShareButton path={href} title={project.title} />
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[13.5px] text-text-tertiary">
          {pay && (
            <span className="text-[14.5px] font-semibold text-accent-text">{pay}</span>
          )}
          {project.location && (
            <span className="flex items-center gap-1.5">
              <MapPin className="size-[15px]" strokeWidth={1.5} />
              {project.location}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Clock className="size-[15px]" strokeWidth={1.5} />
            Posted {posted}
          </span>
        </div>

        {project.description && (
          <p className="mt-2.5 text-[15px] leading-[1.6] text-text-secondary">
            {project.description}
          </p>
        )}

        {project.tags && project.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {project.tags.map((tag) => (
              <span
                key={tag}
                className="whitespace-nowrap rounded-pill border border-border-hairline bg-surface-sunken px-3 py-1 text-[12.5px] text-text-secondary"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2.5">
          <Link
            href={href}
            className="focus-ring rounded-pill bg-accent px-[22px] py-[11px] text-sm font-semibold text-on-accent transition-opacity hover:opacity-90 max-sm:w-full max-sm:text-center"
          >
            View details &amp; apply
          </Link>
          {circleApplied > 0 && (
            // No avatar stack: circle_applied_counts() returns a bare count and
            // never WHO (supabase/projects-saved.sql §2), so drawing faces here
            // would mean inventing them.
            <span className="flex items-center gap-1.5 text-[13px] text-text-secondary">
              <Users className="size-4 text-text-tertiary" strokeWidth={1.5} />
              {circleApplied} in your circle applied
            </span>
          )}
        </div>
      </div>

      {/* ── Right rail (a tinted foot block below 640px) ─────────────── */}
      <div className="w-[290px] shrink-0 border-l border-border-hairline bg-surface-sunken px-5 py-[18px] max-sm:w-full max-sm:border-l-0 max-sm:border-t max-sm:px-4">
        <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-text-tertiary">
          Roles open · {roles.length}
        </p>

        {roles.length === 0 ? (
          <p className="mt-3 text-[13px] text-text-tertiary">
            No individual roles listed — apply to the production.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {roles.slice(0, RAIL_ROLES).map((role) => {
              const qualifier = roleQualifier(role);
              const applied = appliedRoleIds.has(role.id);
              return (
                <li key={role.id} className="flex items-center gap-2.5">
                  <Avatar
                    name={role.name}
                    className="size-7 bg-avatar-fill text-[11px] text-text-secondary"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold leading-tight text-text-primary">
                      {role.name}
                    </p>
                    {qualifier && (
                      <p className="truncate text-[12.5px] text-text-tertiary">
                        {qualifier}
                      </p>
                    )}
                  </div>
                  {applied ? (
                    <span className="shrink-0 rounded-pill bg-accent-tint px-3 py-1 text-[12.5px] font-semibold text-accent-text">
                      Applied
                    </span>
                  ) : (
                    <Link
                      href={`${href}?role=${role.id}`}
                      className="focus-ring shrink-0 rounded-pill border-[1.5px] border-accent px-3 py-1 text-[12.5px] font-semibold text-accent-text transition-colors hover:bg-accent-tint"
                    >
                      Apply
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {roles.length > RAIL_ROLES && (
          <Link
            href={href}
            className="focus-ring mt-3 inline-block text-[13px] font-semibold text-accent-text hover:underline"
          >
            + {roles.length - RAIL_ROLES} more roles →
          </Link>
        )}

        <div className="mt-4 flex items-center gap-2.5 border-t border-border-hairline pt-3.5">
          <Avatar
            name={project.poster?.display_name}
            className="size-7 bg-avatar-fill text-[11px] text-text-secondary"
          />
          <div className="min-w-0">
            <p className="truncate text-[13px] text-text-secondary">
              Posted by{" "}
              <span className="font-semibold text-text-primary">
                {project.poster?.display_name || "A member"}
              </span>
            </p>
            {project.poster?.role && (
              <p className="truncate text-[12.5px] text-text-tertiary">
                {disciplineLabel(project.poster.role)}
              </p>
            )}
          </div>
        </div>
      </div>
    </CallboardCard>
  );
}

function StatusChip({
  tone,
  children,
}: {
  tone: "accent" | "success" | "muted";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "flex items-center gap-1 rounded-chip px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]",
        tone === "accent" && "bg-accent-tint text-accent-text",
        tone === "success" && "bg-success-bg text-success",
        tone === "muted" &&
          "border border-border-hairline bg-surface-sunken text-text-secondary"
      )}
    >
      {children}
    </span>
  );
}
