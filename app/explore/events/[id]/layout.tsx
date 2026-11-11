import { ViewerShell } from "@/components/ViewerShell";

/**
 * The event page is PUBLIC (open to anon readers). Members see it inside
 * their own app, visitors get the public top nav (components/ViewerShell.tsx).
 * Scoped to [id] on purpose: /explore/events/new has its own shell.
 */
export default function EventDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ViewerShell>{children}</ViewerShell>;
}
