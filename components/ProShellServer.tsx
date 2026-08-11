import { getNavCounts } from "@/lib/nav-counts";
import { ProShell } from "@/components/ProShell";

/**
 * Server wrapper around the (client) ProShell: the one place the nav badge
 * counts are fetched. Layouts render THIS, never ProShell directly — one
 * query to keep in sync instead of nine.
 */
export async function ProShellServer({
  children,
  wide = false,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  const counts = await getNavCounts();
  return (
    <ProShell counts={counts} wide={wide}>
      {children}
    </ProShell>
  );
}
