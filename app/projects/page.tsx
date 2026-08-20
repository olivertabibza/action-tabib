import Link from "next/link";
import { redirect } from "next/navigation";
import { FolderPlus, Plus, Star } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { AGE_BANDS } from "@/lib/marketplace";
import { CallboardCard } from "@/components/CallboardCard";
import { hrefWith, type BrowseParams } from "./browse-params";
import { ProjectSearchCard } from "./project-search";
import { SortSelect } from "./sort-select";
import { ProjectRow, type ProjectRowData, type RoleRow } from "./project-row";

/** One "page" of the Load more pagination. */
const PAGE_SIZE = 10;

/**
 * Hard cap on how many matching projects one browse query pulls. The page
 * fetches the whole matching set and slices it, which is what lets the results
 * bar quote HONEST totals ("N roles across N productions") from the same data
 * that renders the cards — one projects query and one roles query, no repeated
 * count queries with the filter predicates duplicated. At beta volumes the set
 * is dozens of rows; the cap keeps that true if it isn't.
 */
const MAX_MATCHES = 200;

/**
 * A free-text query goes into a PostgREST `or=(…)` filter string, where commas
 * and parentheses are syntax. Strip them rather than trying to escape them —
 * they are not meaningful in a project search anyway.
 */
function sanitizeQuery(value: string) {
  return value.replace(/[,()\\"*%]/g, " ").trim();
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<BrowseParams>;
}) {
  const raw = await searchParams;
  const params: BrowseParams = {
    q: raw.q?.trim() || undefined,
    location: raw.location?.trim() || undefined,
    discipline: raw.discipline || undefined,
    gender: raw.gender || undefined,
    age: raw.age || undefined,
    type: raw.type || undefined,
    sort: raw.sort === "pay" ? "pay" : undefined,
    size: raw.size || undefined,
    saved: raw.saved === "1" ? "1" : undefined,
  };
  const sort = params.sort ?? "new";
  const size = Math.min(
    Math.max(Number(params.size) || PAGE_SIZE, PAGE_SIZE),
    MAX_MATCHES
  );

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // The approved-pro gate lives in app/projects/layout.tsx; this only narrows
  // the type — the page never renders without a session.
  if (!user) {
    redirect("/login");
  }

  // The caller's project saves, in ONE query doing three jobs: the header's
  // "★ Saved (N)" count, each card's bookmark state, and the ?saved=1 filter.
  const { data: savedRows } = await supabase
    .from("saved_items")
    .select("item_id")
    .eq("user_id", user.id)
    .eq("item_type", "project");
  const savedIds = new Set((savedRows ?? []).map((r) => r.item_id as string));

  // Gender and Age are properties of ROLES, not projects, so they resolve to a
  // set of project ids first and constrain the projects query below. An empty
  // set must reach `.in("id", [])` and render the empty state — never fall
  // through to "every project".
  let roleFilteredIds: string[] | null = null;
  if (params.gender || params.age) {
    let roleQuery = supabase
      .from("project_roles")
      .select("project_id")
      .eq("status", "open");
    if (params.gender) {
      roleQuery = roleQuery.eq("gender", params.gender);
    }
    const band = AGE_BANDS.find((b) => b.value === params.age);
    if (band) {
      // Range overlap, with a null bound meaning "unbounded on that side".
      roleQuery = roleQuery
        .or(`age_min.is.null,age_min.lte.${band.max}`)
        .or(`age_max.is.null,age_max.gte.${band.min}`);
    }
    const { data } = await roleQuery;
    roleFilteredIds = [...new Set((data ?? []).map((r) => r.project_id as string))];
  }

  // ── One query for the matching projects ──────────────────────────────────
  let projectQuery = supabase
    .from("projects")
    .select(
      "id, title, description, location, project_type, pay_min, pay_max, pay_unit, tags, staff_pick, posted_at, poster:profiles!projects_created_by_fkey(display_name, role)"
    )
    .eq("status", "open");

  const q = params.q ? sanitizeQuery(params.q) : "";
  if (q) {
    projectQuery = projectQuery.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
  }
  if (params.location) {
    projectQuery = projectQuery.ilike("location", `%${params.location}%`);
  }
  // A discipline filter matches any project whose disciplines array contains
  // the selected value — and also surfaces "any discipline" projects.
  if (params.discipline) {
    projectQuery = projectQuery.overlaps("disciplines", [params.discipline, "any"]);
  }
  if (params.type) {
    projectQuery = projectQuery.eq("project_type", params.type);
  }
  if (params.saved) {
    projectQuery = projectQuery.in("id", [...savedIds]);
  }
  if (roleFilteredIds) {
    projectQuery = projectQuery.in("id", roleFilteredIds);
  }

  projectQuery =
    sort === "pay"
      ? projectQuery
          .order("pay_max", { ascending: false, nullsFirst: false })
          .order("posted_at", { ascending: false })
      : projectQuery.order("posted_at", { ascending: false });

  const { data: matched, error } = await projectQuery.limit(MAX_MATCHES);

  const projects = (matched ?? []).map((p) => ({
    ...p,
    // Supabase types embedded relations as arrays; this FK is to-one at runtime.
    poster: p.poster as unknown as ProjectRowData["poster"],
  })) as ProjectRowData[];
  const pageProjects = projects.slice(0, size);
  const pageIds = pageProjects.map((p) => p.id);
  const allIds = projects.map((p) => p.id);

  // ── One query for every role, grouped in JS ──────────────────────────────
  // Fetched across the WHOLE match set, not just the page, because it serves
  // both the rails and the results bar's role total.
  const rolesByProject = new Map<string, RoleRow[]>();
  let totalRoles = 0;
  if (allIds.length > 0) {
    const { data: roleRows } = await supabase
      .from("project_roles")
      .select("id, project_id, name, billing, gender, age_min, age_max")
      .in("project_id", allIds)
      .eq("status", "open")
      .order("sort_order", { ascending: true });
    for (const role of (roleRows ?? []) as RoleRow[]) {
      const list = rolesByProject.get(role.project_id);
      if (list) list.push(role);
      else rolesByProject.set(role.project_id, [role]);
    }
    totalRoles = roleRows?.length ?? 0;
  }

  // ── Circle counts (ONE batched RPC) and the caller's role applications ───
  const circleApplied = new Map<string, number>();
  const appliedRoleIds = new Set<string>();
  if (pageIds.length > 0) {
    const [circleRes, appliedRes] = await Promise.all([
      supabase.rpc("circle_applied_counts", { p_project_ids: pageIds }),
      // NOT has_applied_to_role() per role — that would be one RPC per rail
      // row. The applications SELECT policy already returns the caller's own
      // rows, so one grouped query answers every Apply pill on the page.
      supabase
        .from("applications")
        .select("role_id")
        .eq("applicant_id", user.id)
        .in("project_id", pageIds)
        .not("role_id", "is", null),
    ]);
    for (const row of (circleRes.data ?? []) as {
      project_id: string;
      applied_count: number;
    }[]) {
      circleApplied.set(row.project_id, Number(row.applied_count));
    }
    for (const row of appliedRes.data ?? []) {
      appliedRoleIds.add(row.role_id as string);
    }
  }

  const hasMore = projects.length > size;
  const capped = projects.length === MAX_MATCHES;

  return (
    <main className="mx-auto flex w-full max-w-[1248px] flex-1 flex-col gap-[18px] py-[30px] pb-11 max-sm:gap-3 max-sm:py-4">
      {/* ── Page header ──────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-accent-text">
            Opportunities
          </p>
          <h1 className="mt-1.5 font-condensed text-[46px] font-semibold leading-none text-text-primary max-sm:text-[34px]">
            Projects
          </h1>
          <p className="mt-2 text-base text-text-secondary">
            Find your next role, crew position, or collaboration.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href={hrefWith(params, {
              saved: params.saved ? undefined : "1",
              size: undefined,
            })}
            aria-pressed={!!params.saved}
            className={cn(
              "focus-ring flex items-center gap-1.5 rounded-pill border-[1.5px] border-accent px-[18px] py-3 text-sm font-semibold transition-colors",
              params.saved
                ? "bg-accent-tint text-accent-text"
                : "text-accent-text hover:bg-accent-tint"
            )}
          >
            <Star
              className={cn("size-4", params.saved && "fill-current")}
              strokeWidth={1.5}
            />
            Saved ({savedIds.size})
          </Link>
          <Link
            href="/projects/new"
            className="focus-ring flex items-center gap-1.5 rounded-pill bg-accent px-[22px] py-3 text-sm font-semibold text-on-accent transition-opacity hover:opacity-90"
          >
            <Plus className="size-4" strokeWidth={1.5} />
            Post a project
          </Link>
        </div>
      </header>

      <ProjectSearchCard params={params} />

      {error && (
        <CallboardCard className="p-4 text-sm text-destructive">
          Couldn&rsquo;t load projects: {error.message}
        </CallboardCard>
      )}

      {/* ── Results bar ──────────────────────────────────────────────── */}
      {/* No Productions / Roles segmented toggle: Productions is the only view
          this phase, and a two-segment control with one working segment reads
          as a broken control. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[15.5px] text-text-secondary">
          Showing{" "}
          <strong className="font-semibold text-text-primary">
            {totalRoles} {totalRoles === 1 ? "role" : "roles"}
          </strong>{" "}
          across{" "}
          <strong className="font-semibold text-text-primary">
            {capped ? `${MAX_MATCHES}+` : projects.length}{" "}
            {projects.length === 1 ? "production" : "productions"}
          </strong>
        </p>
        <SortSelect value={sort} />
      </div>

      {/* ── Results ──────────────────────────────────────────────────── */}
      {pageProjects.length > 0 ? (
        <>
          <div className="flex flex-col gap-4 max-sm:gap-3">
            {pageProjects.map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                roles={rolesByProject.get(project.id) ?? []}
                circleApplied={circleApplied.get(project.id) ?? 0}
                saved={savedIds.has(project.id)}
                appliedRoleIds={appliedRoleIds}
              />
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-1.5">
              <Link
                href={hrefWith(params, { size: String(size + PAGE_SIZE) })}
                scroll={false}
                className="focus-ring rounded-pill border-[1.5px] border-accent px-6 py-3 text-sm font-semibold text-accent-text transition-colors hover:bg-accent-tint"
              >
                Load more projects
              </Link>
            </div>
          )}
        </>
      ) : (
        !error && (
          <CallboardCard className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <FolderPlus className="size-8 text-text-tertiary" strokeWidth={1.5} />
            <p className="font-condensed text-[21px] font-semibold text-text-primary">
              No projects match yet
            </p>
            <p className="max-w-sm text-[15px] text-text-secondary">
              {params.saved
                ? "You haven't bookmarked any projects yet."
                : "Try clearing your filters, or be the first to post something here."}
            </p>
            <Link
              href="/projects/new"
              className="focus-ring mt-1 rounded-pill bg-accent px-[22px] py-3 text-sm font-semibold text-on-accent transition-opacity hover:opacity-90"
            >
              Post a project
            </Link>
          </CallboardCard>
        )
      )}
    </main>
  );
}
