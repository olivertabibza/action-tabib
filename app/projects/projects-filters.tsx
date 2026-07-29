"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { DISCIPLINES, disciplineLabel } from "@/lib/marketplace";

/**
 * Discipline + location filters. State lives in the URL query string so the
 * server component can read it and re-query; this keeps the list shareable and
 * avoids client-side fetching.
 */
export function ProjectsFilters({
  discipline,
  location,
}: {
  discipline: string;
  location: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    router.push(`/projects?${next.toString()}`);
  }

  const hasFilters = discipline || location;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
      <div className="flex flex-col gap-2 sm:w-56">
        <Label htmlFor="filter-discipline">Discipline</Label>
        <NativeSelect
          id="filter-discipline"
          value={discipline}
          onChange={(e) => setParam("discipline", e.target.value)}
        >
          <option value="">All disciplines</option>
          {DISCIPLINES.map((d) => (
            <option key={d} value={d}>
              {disciplineLabel(d)}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="flex flex-col gap-2 sm:flex-1">
        <Label htmlFor="filter-location">Location</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="filter-location"
            defaultValue={location}
            placeholder="Search by location…"
            className="pl-9"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setParam("location", e.currentTarget.value.trim());
              }
            }}
            onBlur={(e) => setParam("location", e.target.value.trim())}
          />
        </div>
      </div>

      {hasFilters && (
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/projects")}
        >
          <X className="size-4" />
          Clear
        </Button>
      )}
    </div>
  );
}
