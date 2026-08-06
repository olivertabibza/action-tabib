import { cn } from "@/lib/utils";

/**
 * The Callboard card shell (design/handoff/README.md — "Card shell (used
 * everywhere)"): surface fill, 1px border, 16px radius, card shadow. Every
 * card on a Callboard screen renders through this so the shell is defined
 * exactly once. overflow-hidden lets full-bleed children (comment wells,
 * cover bands) clip to the radius.
 */
export function CallboardCard({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-card border border-border bg-surface shadow-card",
        className
      )}
      {...props}
    />
  );
}
