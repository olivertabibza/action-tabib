"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { applicationDecisionSchema, type ApplicationDecision } from "./schema";

/**
 * Re-check admin rights on the server before any write. The /admin layout gates
 * the pages, but a Server Action can be invoked directly, so we never rely on
 * the page gate alone. Returns the Supabase client on success, or an error.
 */
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Your session has expired. Please log in again." as const };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) {
    return { error: "You don't have permission to do that." as const };
  }

  return { supabase };
}

/**
 * Approve, reject, or re-queue (back to pending) a professional's application.
 * RLS also restricts this to admins; the requireAdmin() check is the in-app
 * second layer, and the account_type filter keeps it to professional rows.
 */
export async function decideApplication(
  profileId: string,
  decision: ApplicationDecision
) {
  const parsed = applicationDecisionSchema.safeParse(decision);
  if (!parsed.success) {
    return { error: "Unknown decision." };
  }

  const gate = await requireAdmin();
  if ("error" in gate) return { error: gate.error };

  const { error } = await gate.supabase
    .from("profiles")
    .update({ application_status: parsed.data })
    .eq("id", profileId)
    .eq("account_type", "professional");

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin");
  return { success: true };
}

/**
 * Close an open project. Moderation is one-directional: no reopen, no delete.
 */
export async function closeProject(projectId: string) {
  const gate = await requireAdmin();
  if ("error" in gate) return { error: gate.error };

  const { error } = await gate.supabase
    .from("projects")
    .update({ status: "closed" })
    .eq("id", projectId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/projects");
  return { success: true };
}
