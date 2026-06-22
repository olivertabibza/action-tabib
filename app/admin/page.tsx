import Link from "next/link";
import { ExternalLink, FileText, Inbox } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { titleCase } from "@/lib/marketplace";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { AdminNav } from "./admin-nav";
import { DecisionButtons } from "./decision-buttons";

const STATUSES = ["pending", "approved", "rejected"] as const;
type Status = (typeof STATUSES)[number];

export default async function AdminApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusParam } = await searchParams;
  const status: Status = STATUSES.includes(statusParam as Status)
    ? (statusParam as Status)
    : "pending";

  const supabase = await createClient();

  const { data: applicants, error } = await supabase
    .from("profiles")
    .select("id, display_name, role, headline, bio, portfolio_files")
    .eq("account_type", "professional")
    .eq("application_status", status)
    .order("display_name");

  // The "portfolios" bucket is PRIVATE, so plain URLs won't load. Mint a
  // short-lived signed URL for each uploaded file — same approach as /profile.
  const filesByProfile = new Map<string, { name: string; url: string }[]>();
  for (const a of applicants ?? []) {
    const paths: string[] = Array.isArray(a.portfolio_files)
      ? a.portfolio_files
      : [];
    const files: { name: string; url: string }[] = [];
    for (const path of paths) {
      const { data: signed } = await supabase.storage
        .from("portfolios")
        .createSignedUrl(path, 60 * 60); // valid for 1 hour
      if (signed?.signedUrl) {
        files.push({
          name: path.split("/").pop() ?? path,
          url: signed.signedUrl,
        });
      }
    }
    filesByProfile.set(a.id, files);
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Admin</h1>
      <p className="mt-2 text-muted-foreground">
        Review industry professional applications.
      </p>

      <div className="mt-8">
        <AdminNav active="applications" />
      </div>

      {/* Status filter */}
      <div className="mb-6 flex gap-1">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={s === "pending" ? "/admin" : `/admin?status=${s}`}
            className={cn(
              "rounded-full px-3 py-1 text-sm font-medium capitalize transition-colors",
              s === status
                ? "bg-brand text-brand-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {s}
          </Link>
        ))}
      </div>

      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Couldn&rsquo;t load applications: {error.message}
        </p>
      )}

      {!error && applicants && applicants.length > 0 ? (
        <div className="flex flex-col gap-4">
          {applicants.map((a) => {
            const files = filesByProfile.get(a.id) ?? [];
            return (
              <Card key={a.id} className="p-2">
                <CardContent className="flex flex-col gap-4 pt-6">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-semibold">
                      {a.display_name || "Unnamed applicant"}
                    </h2>
                    {a.role && (
                      <span className="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand">
                        {titleCase(a.role)}
                      </span>
                    )}
                  </div>

                  {a.headline && (
                    <p className="text-foreground/90">{a.headline}</p>
                  )}
                  {a.bio && (
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {a.bio}
                    </p>
                  )}

                  <div>
                    <p className="mb-2 text-sm font-medium text-muted-foreground">
                      Portfolio
                    </p>
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
                        No portfolio files uploaded.
                      </p>
                    )}
                  </div>

                  <div className="border-t border-border pt-4">
                    <DecisionButtons profileId={a.id} current={status} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        !error && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
            <Inbox className="size-8 text-muted-foreground" />
            <p className="font-medium">No {status} applications</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {status === "pending"
                ? "Nothing waiting for review right now."
                : `No one is ${status} yet.`}
            </p>
          </div>
        )
      )}
    </main>
  );
}
