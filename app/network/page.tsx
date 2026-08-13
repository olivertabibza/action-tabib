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
import { Avatar } from "@/components/Avatar";
import { CallboardCard } from "@/components/CallboardCard";
import { ConnectionRequestActions } from "@/components/ConnectionRequestActions";
import { MessageButton } from "@/app/messages/message-button";
import { FollowButton } from "./follow-button";

type Requester = {
  id: string;
  display_name: string | null;
  role: string | null;
};

export default async function NetworkPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // The Pro gate (auth + approved professional) lives in app/network/layout.tsx;
  // the page still reads `user` to scope the queries below.
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

  // Incoming connection requests. The feed's right rail is hidden below 1180px,
  // so this — not the rail card — is where a request is always reachable. The
  // "Parties read own connections" SELECT policy covers this directly: the
  // viewer is the addressee of every row read.
  const { data: pending } = await supabase
    .from("connections")
    .select("requester_id, created_at")
    .eq("addressee_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  let requests: Requester[] = [];
  if (pending && pending.length > 0) {
    const { data: requesters } = await supabase
      .from("profiles")
      .select("id, display_name, role")
      .in(
        "id",
        pending.map((p) => p.requester_id)
      );
    const byId = new Map(
      (requesters ?? []).map((p) => [p.id as string, p as Requester])
    );
    requests = pending
      .map((p) => byId.get(p.requester_id as string))
      .filter((p): p is Requester => p !== undefined);
  }

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

      {/* This section is already in the Callboard idiom while the grid below
          is still the old shadcn one — deliberate: the rest of the page gets
          its restyle in a later phase. */}
      {requests.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-xl font-semibold tracking-tight">
            Connection requests{" "}
            <span className="text-muted-foreground">({requests.length})</span>
          </h2>
          <CallboardCard className="p-4">
            <ul className="flex flex-col gap-4">
              {requests.map((r) => (
                <li key={r.id} className="flex gap-3">
                  <Avatar
                    name={r.display_name}
                    className="size-11 bg-avatar-fill text-text-secondary"
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/profile/${r.id}`}
                      className="block truncate font-condensed text-[17px] font-semibold leading-tight text-text-primary transition-colors hover:text-accent"
                    >
                      {r.display_name || "Unnamed creator"}
                    </Link>
                    <p className="truncate text-[12.5px] text-text-tertiary">
                      {r.role ? titleCase(r.role) : "Pro"}
                    </p>
                    <ConnectionRequestActions
                      requesterId={r.id}
                      className="mt-2"
                    />
                  </div>
                </li>
              ))}
            </ul>
          </CallboardCard>
        </section>
      )}

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
                <div className="flex items-center gap-2">
                  <FollowButton
                    targetId={c.id}
                    initialFollowing={followingSet.has(c.id)}
                  />
                  <MessageButton otherId={c.id} />
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
