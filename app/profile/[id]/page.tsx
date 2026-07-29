import Link from "next/link";
import { ArrowLeft, ExternalLink, FileText, UserRound } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { resolveBackLink } from "@/lib/back-link";
import { signedPortfolioUrls } from "@/lib/portfolio";
import { disciplineLabel } from "@/lib/marketplace";
import { MessageButton } from "@/app/messages/message-button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Public, read-only view of one industry professional. Distinct from
 * app/profile/page.tsx (the signed-in user's own editable profile). Only
 * approved professionals are exposed here — pending/rejected applicants and
 * consumers fall through to a "not found" state so unapproved people aren't
 * discoverable.
 */
export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Read from the `public_profiles` view, which already filters to approved
  // professionals and exposes only public-safe columns. Anon has SELECT on the
  // view (see supabase/public-profiles.sql) while the underlying profiles table
  // stays locked down — so the normal anon client is enough, no secret key.
  // A null result means not found (bad id, consumer, or pending/rejected pro).
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("public_profiles")
    .select("id, display_name, role, headline, bio, portfolio_files, skills")
    .eq("id", id)
    .maybeSingle();

  // Back-link target depends on the viewer: /projects (the old target) is
  // pro-only and redirects fans away. Approved pros reach profiles from Network;
  // fans reach them from their Explore. Read the session only to pick the link.
  // This is the fallback: when the viewer arrived from another in-app page
  // (Feed, Projects, Network, Admin…) we send them back there instead
  // (resolveBackLink, via the referer).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let fallbackHref = "/";
  let fallbackLabel = "Back";
  let viewerIsApprovedPro = false;
  if (user) {
    const { data: viewer } = await supabase
      .from("profiles")
      .select("account_type, application_status")
      .eq("id", user.id)
      .maybeSingle();
    if (
      viewer?.account_type === "professional" &&
      viewer?.application_status === "approved"
    ) {
      viewerIsApprovedPro = true;
      fallbackHref = "/explore";
      fallbackLabel = "Back to Explore";
    } else {
      fallbackHref = "/fan/explore";
      fallbackLabel = "Back to Explore";
    }
  }
  const { href: backHref, label: backLabel } = await resolveBackLink(
    `/profile/${id}`,
    { href: fallbackHref, label: fallbackLabel }
  );

  if (!profile) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <UserRound className="size-8 text-muted-foreground" />
          <p className="font-medium">Profile not found</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            This profile doesn&rsquo;t exist or isn&rsquo;t public.
          </p>
        </div>
      </main>
    );
  }

  // The "portfolios" bucket is private, but the storage policy in
  // supabase/public-profiles.sql lets anyone read an approved pro's files, so
  // the anon client can mint signed URLs here.
  const files = await signedPortfolioUrls(supabase, profile.portfolio_files);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
      <Link
        href={backHref}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {backLabel}
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {profile.display_name || "A member"}
        </h1>
        {profile.role && (
          <span className="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand">
            {disciplineLabel(profile.role)}
          </span>
        )}
      </div>

      {profile.headline && (
        <p className="mt-3 text-lg text-foreground/90">{profile.headline}</p>
      )}

      {Array.isArray(profile.skills) && profile.skills.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium text-muted-foreground">Skills</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {(profile.skills as string[]).map((skill) => (
              <span
                key={skill}
                className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground/80"
              >
                {disciplineLabel(skill)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Message: only an approved pro can DM, and never yourself. */}
      {viewerIsApprovedPro && user && user.id !== profile.id && (
        <div className="mt-5">
          <MessageButton otherId={profile.id} variant="default" />
        </div>
      )}

      <div className="mt-8 flex flex-col gap-6">
        {profile.bio && (
          <Card className="p-2">
            <CardHeader>
              <CardTitle className="text-xl">About</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {profile.bio}
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="p-2">
          <CardHeader>
            <CardTitle className="text-xl">Portfolio</CardTitle>
          </CardHeader>
          <CardContent>
            {files.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {files.map((file) => (
                  <li key={file.url}>
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm transition-colors hover:border-brand hover:bg-muted/50"
                    >
                      <FileText className="size-4 shrink-0 text-brand" />
                      <span className="truncate">{file.name}</span>
                      <ExternalLink className="ml-auto size-4 shrink-0 text-muted-foreground" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No portfolio files.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
