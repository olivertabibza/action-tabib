import { redirect } from "next/navigation";
import { ExternalLink, FileText } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProfileForm } from "./profile-form";

function accountLabel(accountType: string | null | undefined) {
  if (accountType === "professional") return "Industry Professional";
  if (accountType === "consumer") return "Consumer";
  return "Member";
}

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Belt-and-braces: the proxy already guards this route, but we never want to
  // render a profile without a session.
  if (!user) {
    redirect("/login");
  }

  // `select("*")` so the page keeps working even before the new columns exist.
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  // The "portfolios" bucket is PRIVATE, so a plain public URL won't load. We
  // mint a short-lived signed URL on the server for each uploaded file.
  const paths: string[] = Array.isArray(profile?.portfolio_files)
    ? profile.portfolio_files
    : [];

  const files: { name: string; url: string }[] = [];
  for (const path of paths) {
    const { data: signed } = await supabase.storage
      .from("portfolios")
      .createSignedUrl(path, 60 * 60); // valid for 1 hour
    if (signed?.signedUrl) {
      files.push({ name: path.split("/").pop() ?? path, url: signed.signedUrl });
    }
  }

  const isProfessional = profile?.account_type === "professional";

  const initial = {
    display_name: profile?.display_name ?? "",
    headline: profile?.headline ?? "",
    bio: profile?.bio ?? "",
  };

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Your profile
        </h1>
        <span className="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand">
          {accountLabel(profile?.account_type)}
        </span>
      </div>

      <div className="flex flex-col gap-6">
        {/* Editable details */}
        <Card className="p-2">
          <CardHeader>
            <CardTitle className="text-xl">Details</CardTitle>
            <CardDescription>How you show up on Action.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm initial={initial} />
          </CardContent>
        </Card>

        {/* Account info (read-only) */}
        <Card className="p-2">
          <CardHeader>
            <CardTitle className="text-xl">Account</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Email</p>
              <p className="mt-1">{user.email}</p>
            </div>
            {profile?.role && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Primary role
                </p>
                <p className="mt-1">{profile.role}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Portfolio (private files, shown via signed URLs) */}
        {isProfessional && (
          <Card className="p-2">
            <CardHeader>
              <CardTitle className="text-xl">Portfolio</CardTitle>
              <CardDescription>
                Files you uploaded with your application.
              </CardDescription>
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
                  No portfolio files uploaded yet.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
