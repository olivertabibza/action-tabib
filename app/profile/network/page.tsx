import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { titleCase } from "@/lib/marketplace";
import { Avatar } from "@/components/Avatar";
import { CallboardCard } from "@/components/CallboardCard";
import { ConnectionRequestActions } from "@/components/ConnectionRequestActions";
import { ProfileTabs } from "../profile-tabs";

type Requester = {
  id: string;
  display_name: string | null;
  role: string | null;
};

type Person = Requester & { account_type: string | null };

/**
 * The viewer's own network: incoming requests, connections, following and
 * followers. /profile is a shared surface (see app/profile/layout.tsx), so this
 * page gates itself: logged out → /login, anyone but an approved pro → /profile.
 * Every read runs as the viewer under the existing RLS — the connections and
 * follows SELECT policies let a user read rows they're a party to.
 */
export default async function ProfileNetworkPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: me } = await supabase
    .from("profiles")
    .select("account_type, application_status")
    .eq("id", user.id)
    .maybeSingle();

  if (
    me?.account_type !== "professional" ||
    me?.application_status !== "approved"
  ) {
    redirect("/profile");
  }

  const [
    { data: pending },
    { data: accepted },
    { data: following },
    { data: followers },
  ] = await Promise.all([
    // Incoming connection requests — the viewer is the addressee of every row.
    supabase
      .from("connections")
      .select("requester_id, created_at")
      .eq("addressee_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("connections")
      .select("requester_id, addressee_id")
      .eq("status", "accepted")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .order("created_at", { ascending: false }),
    supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("follows")
      .select("follower_id")
      .eq("following_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const requestIds = (pending ?? []).map((p) => p.requester_id as string);
  const connectionIds = (accepted ?? []).map((c) =>
    (c.requester_id === user.id ? c.addressee_id : c.requester_id) as string
  );
  const followingIds = (following ?? []).map((f) => f.following_id as string);
  const followerIds = (followers ?? []).map((f) => f.follower_id as string);

  // One profiles read for everyone on the page (approved pros can read all
  // profiles, consumers included).
  const allIds = [
    ...new Set([
      ...requestIds,
      ...connectionIds,
      ...followingIds,
      ...followerIds,
    ]),
  ];
  const byId = new Map<string, Person>();
  if (allIds.length > 0) {
    const { data: people } = await supabase
      .from("profiles")
      .select("id, display_name, role, account_type")
      .in("id", allIds);
    for (const p of people ?? []) byId.set(p.id as string, p as Person);
  }
  const resolve = (ids: string[]) =>
    ids.map((id) => byId.get(id)).filter((p): p is Person => p !== undefined);

  const requests: Requester[] = resolve(requestIds);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
      <ProfileTabs active="network" />
      <h1 className="mb-8 text-3xl font-bold tracking-tight sm:text-4xl">
        Your network
      </h1>

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

      <PeopleSection
        title="Connections"
        people={resolve(connectionIds)}
        empty="No connections yet."
      />
      <PeopleSection
        title="Following"
        people={resolve(followingIds)}
        empty="You aren't following anyone yet."
      />
      <PeopleSection
        title="Followers"
        people={resolve(followerIds)}
        empty="No followers yet."
      />
    </main>
  );
}

function PeopleSection({
  title,
  people,
  empty,
}: {
  title: string;
  people: Person[];
  empty: string;
}) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-xl font-semibold tracking-tight">
        {title}{" "}
        <span className="text-muted-foreground">({people.length})</span>
      </h2>
      {people.length > 0 ? (
        <CallboardCard className="p-4">
          <ul className="flex flex-col gap-4">
            {people.map((p) => (
              <PersonRow key={p.id} person={p} />
            ))}
          </ul>
        </CallboardCard>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}

// /profile/[id] only renders professionals, so fans get a plain name.
function PersonRow({ person }: { person: Person }) {
  const name = person.display_name || "Unnamed member";
  const isPro = person.account_type === "professional";
  return (
    <li className="flex items-center gap-3">
      <Avatar
        name={person.display_name}
        className="size-11 bg-avatar-fill text-text-secondary"
      />
      <div className="min-w-0 flex-1">
        {isPro ? (
          <Link
            href={`/profile/${person.id}`}
            className="block truncate font-condensed text-[17px] font-semibold leading-tight text-text-primary transition-colors hover:text-accent"
          >
            {name}
          </Link>
        ) : (
          <p className="truncate font-condensed text-[17px] font-semibold leading-tight text-text-primary">
            {name}
          </p>
        )}
        <p className="truncate text-[12.5px] text-text-tertiary">
          {person.role ? titleCase(person.role) : isPro ? "Pro" : "Fan"}
        </p>
      </div>
    </li>
  );
}
