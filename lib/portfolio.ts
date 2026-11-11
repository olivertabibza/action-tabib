import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type PortfolioFile = { name: string; url: string; path: string };

/** File types a portfolio accepts (onboarding and /profile). */
export const PORTFOLIO_ACCEPT = ".pdf,.doc,.docx,video/*,image/*";

/** profiles_portfolio_files_check (supabase/portfolios.sql) allows 10. */
export const MAX_PORTFOLIO_FILES = 10;

/**
 * Where a new portfolio file goes: its own random folder inside the owner's,
 * so two files with the same name never overwrite each other (ENG F12). The
 * last segment stays the original name, which is what lists show.
 */
export function newPortfolioPath(userId: string, fileName: string): string {
  const safeName = fileName.replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 200);
  return `${userId}/${crypto.randomUUID()}/${safeName}`;
}

/**
 * The "portfolios" bucket is PRIVATE, so plain URLs won't load. Mint a
 * short-lived signed URL (valid 1 hour) for each stored path. Shared by the
 * admin review queue, the project owner's applicants view and /profile so the
 * logic can't drift.
 */
export async function signedPortfolioUrls(
  supabase: SupabaseServerClient,
  portfolioFiles: unknown
): Promise<PortfolioFile[]> {
  const paths: string[] = Array.isArray(portfolioFiles) ? portfolioFiles : [];
  const files: PortfolioFile[] = [];
  for (const path of paths) {
    const { data: signed } = await supabase.storage
      .from("portfolios")
      .createSignedUrl(path, 60 * 60); // valid for 1 hour
    if (signed?.signedUrl) {
      files.push({
        name: path.split("/").pop() ?? path,
        url: signed.signedUrl,
        path,
      });
    }
  }
  return files;
}
