import Link from "next/link";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { titleCase } from "@/lib/marketplace";
import { FollowButton } from "./follow-button";

export default async function NetworkPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_type, application_status")
    .eq("id", user.id)
    .maybeSingle();

  if (
    profile?.account_type !== "professional" ||
    profile?.application_status !== "approved"
  ) {
    redirect("/home");
  }

  // Other approved professionals (RLS lets approved pros read all profiles).
  // Consumers and the current user are excluded.
  const { data: creators, error } = await supabase
    .from("profiles")
    .select("id, display_name, role, headline")
    .eq("account_type", "professional")
    .eq("application_status", "approved")
    .neq("id", user.id)
    .order("display_name", { nullsFirst: false });

  // Who the current user already follows, so each card shows the right state.
  const { data: myFollows } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", user.id);
  const followingSet = new Set(
    (myFollows ?? []).map((f) => f.following_id as string)
  );

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Discover creators
        </h1>
        <p className="mt-2 text-muted-foreground">
          Follow other professionals to see their updates in your dashboard feed.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Couldn&rsquo;t load creators: {error.message}
        </p>
      )}

      {!error && creators && creators.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {creators.map((c) => (
            <Card key={c.id} className="h-full p-2">
              <CardHeader>
                <CardTitle className="text-lg">
                  <Link
                    href={`/profile/${c.id}`}
                    className="transition-colors hover:text-brand"
                  >
                    {c.display_name || "Unnamed creator"}
                  </Link>
                </CardTitle>
                {c.role && (
                  <p className="text-sm text-muted-foreground">
                    {titleCase(c.role)}
                  </p>
                )}
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {c.headline && (
                  <p className="line-clamp-2 text-sm text-foreground/80">
                    {c.headline}
                  </p>
                )}
                <div>
                  <FollowButton
                    targetId={c.id}
                    initialFollowing={followingSet.has(c.id)}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        !error && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
            <Users className="size-8 text-muted-foreground" />
            <p className="font-medium">No other creators yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              As more professionals are approved, they&rsquo;ll show up here to
              follow.
            </p>
          </div>
        )
      )}
    </main>
  );
}
