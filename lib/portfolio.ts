import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type PortfolioFile = { name: string; url: string };

/**
 * The "portfolios" bucket is PRIVATE, so plain URLs won't load. Mint a
 * short-lived signed URL (valid 1 hour) for each stored path. Shared by the
 * admin review queue and the project owner's applicants view so the logic
 * can't drift. (app/profile still inlines the same loop — migrate it here if
 * you touch that file.)
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
      files.push({ name: path.split("/").pop() ?? path, url: signed.signedUrl });
    }
  }
  return files;
}
