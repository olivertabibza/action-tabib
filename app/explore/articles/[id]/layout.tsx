import { SiteNav } from "@/components/SiteNav";

/**
 * The article detail page is PUBLIC (open to anon readers), so it gets the
 * global top nav instead of a shell. Scoped to [id] on purpose:
 * /explore/articles/new renders inside ProShell and must not get a second bar.
 */
export default function ArticleDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteNav />
      {children}
    </>
  );
}
