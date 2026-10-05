"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  applicationDecisionSchema,
  autoApproveKindSchema,
  contentDecisionSchema,
  contentKindSchema,
  type ApplicationDecision,
  type AutoApproveKind,
  type ContentDecision,
  type ContentKind,
} from "./schema";

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
 * Approve (publish), reject, or re-queue a submitted event or article. RLS also
 * restricts content updates to admins; requireAdmin() is the in-app second
 * layer. Revalidates every surface the row can appear on plus its detail page.
 */
export async function decideContent(
  kind: ContentKind,
  id: string,
  decision: ContentDecision
) {
  const parsedKind = contentKindSchema.safeParse(kind);
  const parsedDecision = contentDecisionSchema.safeParse(decision);
  if (!parsedKind.success || !parsedDecision.success) {
    return { error: "Unknown decision." };
  }

  const gate = await requireAdmin();
  if ("error" in gate) return { error: gate.error };

  const table =
    parsedKind.data === "event"
      ? "events"
      : parsedKind.data === "article"
        ? "articles"
        : "classes";
  const { error } = await gate.supabase
    .from(table)
    .update({ status: parsedDecision.data })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/content");
  if (table === "classes") {
    // Classes are pro-only and live under /classes, not /explore.
    revalidatePath("/classes");
    revalidatePath(`/classes/${id}`);
  } else {
    revalidatePath("/explore");
    revalidatePath("/fan/explore");
    revalidatePath("/fan/events");
    revalidatePath(`/explore/${table}/${id}`);
  }
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

/**
 * Turn one auto-approve switch on or off. RLS limits platform_settings updates
 * to admins; requireAdmin() is the in-app second layer. Turning a switch off
 * only affects future submissions — nothing already approved is reverted.
 */
export async function setAutoApprove(kind: AutoApproveKind, enabled: boolean) {
  const parsed = autoApproveKindSchema.safeParse(kind);
  if (!parsed.success || typeof enabled !== "boolean") {
    return { error: "Unknown setting." };
  }

  const gate = await requireAdmin();
  if ("error" in gate) return { error: gate.error };

  const { error } = await gate.supabase
    .from("platform_settings")
    .update({ [`auto_approve_${parsed.data}`]: enabled })
    .eq("id", true);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/settings");
  return { success: true };
}

/**
 * Approve everything currently pending of one kind, as the admin through RLS.
 * Pro applications are limited to professional rows: consumers also sit at
 * application_status = 'pending' and must never be approved.
 */
export async function approveAllPending(kind: AutoApproveKind) {
  const parsed = autoApproveKindSchema.safeParse(kind);
  if (!parsed.success) {
    return { error: "Unknown queue." };
  }

  const gate = await requireAdmin();
  if ("error" in gate) return { error: gate.error };

  const { error, count } =
    parsed.data === "pro_applications"
      ? await gate.supabase
          .from("profiles")
          .update({ application_status: "approved" }, { count: "exact" })
          .eq("account_type", "professional")
          .eq("application_status", "pending")
      : await gate.supabase
          .from(parsed.data)
          .update({ status: "published" }, { count: "exact" })
          .eq("status", "pending");

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/settings");
  if (parsed.data === "pro_applications") {
    revalidatePath("/admin");
  } else {
    revalidatePath("/admin/content");
    if (parsed.data === "classes") {
      revalidatePath("/classes");
    } else {
      revalidatePath("/explore");
      revalidatePath("/fan/explore");
      revalidatePath("/fan/events");
    }
  }
  return { success: true, count: count ?? 0 };
}
