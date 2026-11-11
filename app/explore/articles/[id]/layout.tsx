import { ViewerShell } from "@/components/ViewerShell";

/**
 * The article page is PUBLIC (open to anon readers). Members see it inside
 * their own app, visitors get the public top nav (components/ViewerShell.tsx).
 * Scoped to [id] on purpose: /explore/articles/new has its own shell.
 */
export default function ArticleDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ViewerShell>{children}</ViewerShell>;
}
