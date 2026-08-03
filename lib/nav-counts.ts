/**
 * Badge counts for the app-chrome nav items (README `nav.counts`). Stub for
 * now: returns zeros so no badges render. Wiring these to real queries (and
 * making them live) is a follow-up task — do not add database reads here
 * without that task.
 */
export type NavCounts = {
  projects: number;
  classes: number;
  network: number;
  messages: number;
};

export function getNavCounts(): NavCounts {
  return { projects: 0, classes: 0, network: 0, messages: 0 };
}
