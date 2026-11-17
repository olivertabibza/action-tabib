import { CallboardCard } from "@/components/CallboardCard";

const BAR = "rounded bg-surface-sunken motion-safe:animate-pulse";

/**
 * What a section shows the moment it's tapped, while the server builds the
 * real page. Each section's loading.tsx renders this INSIDE its layout, so the
 * shell and nav stay where they are and only the content area waits. Without
 * it a tap did nothing visible until the whole page was ready.
 *
 * No data and no client code, so Next.js can prefetch it with the layout.
 */
export function PageSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex w-full flex-col gap-4 max-sm:gap-3"
    >
      <span className="sr-only">Loading…</span>
      <div className={`h-7 w-40 ${BAR}`} />
      {Array.from({ length: cards }, (_, i) => (
        <CallboardCard key={i} className="flex flex-col gap-3 p-4">
          <div className="flex items-center gap-3">
            <div
              className="size-10 shrink-0 rounded-full bg-surface-sunken motion-safe:animate-pulse"
            />
            <div className="flex flex-1 flex-col gap-2">
              <div className={`h-3.5 w-1/3 ${BAR}`} />
              <div className={`h-3 w-1/4 ${BAR}`} />
            </div>
          </div>
          <div className={`h-3 w-full ${BAR}`} />
          <div className={`h-3 w-5/6 ${BAR}`} />
        </CallboardCard>
      ))}
    </div>
  );
}
