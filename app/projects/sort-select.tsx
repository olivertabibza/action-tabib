"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { SORTS } from "./browse-params";

/**
 * The results bar's Sort dropdown. Only the two sorts that map onto a real
 * column ship: Newest first (posted_at desc) and Pay (pay_max desc, nulls
 * last). The design also lists "Closing soon" and "Relevance"; projects have
 * no deadline column and there is no relevance ranking, so those are left OUT
 * of the menu rather than offered as options that do nothing.
 *
 * Changing the sort drops `size`, resetting pagination to the first page.
 */
export function SortSelect({ value }: { value: string }) {
  const router = useRouter();
  const params = useSearchParams();

  return (
    <label className="flex w-[160px] shrink-0 flex-col justify-center gap-0.5 rounded-input border border-border bg-surface px-3 py-2">
      <span className="text-[11px] leading-none text-text-tertiary">Sort</span>
      <select
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          next.set("sort", e.target.value);
          next.delete("size");
          router.push(`/projects?${next.toString()}`);
        }}
        className="w-full cursor-pointer bg-transparent text-sm font-semibold text-text-primary outline-none"
      >
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  );
}
