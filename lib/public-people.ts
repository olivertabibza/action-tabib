import { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export type PublicPerson = { display_name: string | null; role: string | null };

/**
 * Hosts' and authors' names, read through the public_profiles view so every
 * viewer sees the same credit (UX B-24). Embedding `profiles` directly follows
 * the viewer's RLS: visitors and fans can't read pros' rows, so they saw "the
 * Action team" where a pro saw the host's name. Anyone not in the view (an
 * admin, a pending or rejected account) has no public name.
 */
export async function publicPeople(
  supabase: ServerClient,
  ids: (string | null | undefined)[]
): Promise<Map<string, PublicPerson>> {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  if (unique.length === 0) return new Map();
  const { data } = await supabase
    .from("public_profiles")
    .select("id, display_name, role")
    .in("id", unique);
  return new Map(
    (data ?? []).map((p) => [p.id, { display_name: p.display_name, role: p.role }])
  );
}
