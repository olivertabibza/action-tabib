/**
 * The /projects browse query, as it lives in the URL. Filter state is in the
 * query string (not client state) so the server component can read it, and so
 * a filtered list stays shareable and back-button-able.
 */
export type BrowseParams = {
  q?: string;
  location?: string;
  discipline?: string;
  gender?: string;
  age?: string;
  type?: string;
  sort?: string;
  size?: string;
  saved?: string;
};

/** The two sorts that have a defensible ordering against this schema. */
export const SORTS = [
  { value: "new", label: "Newest first" },
  { value: "pay", label: "Pay" },
] as const;

/**
 * Build a /projects href from the current params plus a patch. An undefined or
 * empty value in the patch drops the key, which is how "All" chips and the
 * Saved toggle clear themselves.
 */
export function hrefWith(
  current: BrowseParams,
  patch: Partial<BrowseParams>
): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...current, ...patch })) {
    if (value) next.set(key, value);
  }
  const qs = next.toString();
  return qs ? `/projects?${qs}` : "/projects";
}
