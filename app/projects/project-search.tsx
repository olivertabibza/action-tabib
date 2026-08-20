import Link from "next/link";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { CallboardCard } from "@/components/CallboardCard";
import {
  AGE_BANDS,
  DISCIPLINES,
  PROJECT_TYPES,
  ROLE_GENDERS,
  disciplineLabel,
  projectTypeLabel,
} from "@/lib/marketplace";
import { hrefWith, type BrowseParams } from "./browse-params";

/**
 * The design's search & filter card (design/handoff/README.md §2), as a plain
 * GET form so it works without client JS and the server component reads the
 * result straight off the query string. `type` and `sort` ride along as hidden
 * inputs so a search doesn't silently clear the chip row or the sort; `size` is
 * deliberately NOT carried, so a new search resets pagination to page one.
 *
 * The design's filter-icon button and its advanced-filter sheet are omitted:
 * there is no sheet/dialog primitive in components/ui, and adding one via the
 * shadcn CLI would drag in the bg-accent remap chore (docs/DECISIONS.md). A
 * button that opened nothing would be worse than no button.
 */
export function ProjectSearchCard({ params }: { params: BrowseParams }) {
  const { q, location, discipline, gender, age, type, sort } = params;

  return (
    <CallboardCard className="p-4">
      <form
        action="/projects"
        method="get"
        className="flex flex-wrap items-stretch gap-[11px]"
      >
        {type && <input type="hidden" name="type" value={type} />}
        {sort && <input type="hidden" name="sort" value={sort} />}

        <div className="flex min-w-[220px] flex-1 items-center gap-2.5 rounded-input border border-border bg-surface-sunken px-3.5">
          <Search
            className="size-[18px] shrink-0 text-text-tertiary"
            strokeWidth={1.5}
          />
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            aria-label="Search projects"
            placeholder="Search projects, roles, production companies…"
            className="min-w-0 flex-1 bg-transparent py-3 text-[15px] text-text-primary outline-none placeholder:text-text-tertiary"
          />
        </div>

        <Field label="Location" className="w-[200px] max-sm:w-full">
          <input
            type="text"
            name="location"
            defaultValue={location ?? ""}
            placeholder="Anywhere"
            className="w-full bg-transparent text-sm font-semibold text-text-primary outline-none placeholder:font-normal placeholder:text-text-tertiary"
          />
        </Field>

        <Field label="Job type" className="w-[170px] max-sm:flex-1">
          <FieldSelect name="discipline" defaultValue={discipline ?? ""}>
            <option value="">All jobs</option>
            {DISCIPLINES.map((d) => (
              <option key={d} value={d}>
                {disciplineLabel(d)}
              </option>
            ))}
          </FieldSelect>
        </Field>

        <Field label="Gender" className="w-[130px] max-sm:flex-1">
          <FieldSelect name="gender" defaultValue={gender ?? ""}>
            <option value="">Any</option>
            {ROLE_GENDERS.filter((g) => g !== "any").map((g) => (
              <option key={g} value={g}>
                {g === "non-binary" ? "Non-binary" : g[0].toUpperCase() + g.slice(1)}
              </option>
            ))}
          </FieldSelect>
        </Field>

        <Field label="Age" className="w-[130px] max-sm:flex-1">
          <FieldSelect name="age" defaultValue={age ?? ""}>
            <option value="">Any age</option>
            {AGE_BANDS.map((band) => (
              <option key={band.value} value={band.value}>
                {band.label}
              </option>
            ))}
          </FieldSelect>
        </Field>

        <button
          type="submit"
          className="focus-ring shrink-0 rounded-pill bg-accent px-6 py-3.5 text-sm font-semibold text-on-accent transition-opacity hover:opacity-90 max-sm:w-full"
        >
          Search
        </button>
      </form>

      {/* Category chips — non-wrapping, scrolling horizontally on mobile. */}
      <div className="mt-3.5 flex gap-2 overflow-x-auto border-t border-border-hairline pt-3.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Chip href={hrefWith(params, { type: undefined, size: undefined })} active={!type}>
          All
        </Chip>
        {PROJECT_TYPES.filter((t) => t !== "other").map((t) => (
          <Chip
            key={t}
            href={hrefWith(params, { type: t, size: undefined })}
            active={type === t}
          >
            {projectTypeLabel(t)}
          </Chip>
        ))}
      </div>
    </CallboardCard>
  );
}

/** 12px-radius bordered box with an 11px label over its control. */
function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        "flex min-w-0 shrink-0 flex-col justify-center gap-0.5 rounded-input border border-border bg-surface px-3 py-2",
        className
      )}
    >
      <span className="text-[11px] leading-none text-text-tertiary">{label}</span>
      {children}
    </label>
  );
}

function FieldSelect(props: React.ComponentProps<"select">) {
  return (
    <select
      {...props}
      className="w-full cursor-pointer bg-transparent text-sm font-semibold text-text-primary outline-none"
    />
  );
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "focus-ring shrink-0 whitespace-nowrap rounded-pill px-[15px] py-[7px] text-[13px] transition-colors",
        active
          ? "bg-accent font-semibold text-on-accent"
          : "border border-border-hairline bg-surface-sunken font-medium text-text-secondary hover:border-border"
      )}
    >
      {children}
    </Link>
  );
}
