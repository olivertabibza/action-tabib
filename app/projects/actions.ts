"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  applicationSchema,
  projectSchema,
  type ApplicationFormValues,
  type ProjectFormValues,
} from "./schema";

/** Tags are display labels, so "Drama" and "drama" are the same tag: dedupe
 *  case-insensitively, first spelling winning. */
function dedupeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of tags) {
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

/**
 * Create a project owned by the signed-in user, then its roles in ONE batch
 * insert. Row Level Security also enforces that only an approved professional
 * can insert, but we re-read the session here so the client can never set
 * `created_by` to someone else.
 *
 * staff_pick is never written: projects_guard_staff_pick (project-roles.sql §2)
 * forces it to false for any non-admin caller, so the form does not offer it.
 */
export async function createProject(values: ProjectFormValues) {
  const parsed = projectSchema.safeParse(values);
  if (!parsed.success) {
    return { error: "Please check the form and try again." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Your session has expired. Please log in again." };
  }

  const { roles, tags, ...project } = parsed.data;

  // "any" is mutually exclusive with specific disciplines (the form enforces
  // this too, but never trust the client). The legacy single-value column keeps
  // being written as the first entry for backward compatibility.
  const disciplines = project.disciplines.includes("any")
    ? ["any"]
    : project.disciplines;

  // Unpaid and deferred projects have NO pay range — the browse card renders no
  // pay line at all for them. The form hides the inputs and clears them; this
  // is the half that doesn't trust the client.
  const paid = project.compensation === "paid";

  const { data, error } = await supabase
    .from("projects")
    .insert({
      created_by: user.id,
      ...project,
      disciplines,
      discipline: disciplines[0],
      pay_min: paid ? project.pay_min : null,
      pay_max: paid ? project.pay_max : null,
      pay_unit: paid ? project.pay_unit : null,
      tags: dedupeTags(tags),
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  const projectId = data.id as string;

  // Roles in one batch insert, never one call per row. sort_order is the
  // role's index in the array — that is the whole ordering rule.
  if (roles.length > 0) {
    const { error: rolesError } = await supabase.from("project_roles").insert(
      roles.map((role, index) => ({
        project_id: projectId,
        ...role,
        sort_order: index,
      }))
    );

    if (rolesError) {
      // The project exists but none of the roles meant to come with it do.
      //
      // NOT a delete: public.projects has no DELETE policy, deliberately
      // (docs/DECISIONS.md), and under RLS a delete with no policy matches no
      // rows and reports SUCCESS — so "delete the just-created project" would
      // silently leave exactly the half-made project it was meant to prevent.
      // Closing is the disposal the schema does allow, and it achieves the
      // same thing that matters: /projects filters on status = 'open', so a
      // closed project never reaches the browse screen. The owner finds it
      // under My projects and can reopen it (a project with no roles is valid
      // — that is the crew-call shape) or post again.
      await supabase
        .from("projects")
        .update({ status: "closed" })
        .eq("id", projectId)
        .eq("created_by", user.id);

      return {
        error:
          "The project was saved but its roles couldn't be added, so it has been left closed. You'll find it under My projects.",
      };
    }
  }

  revalidatePath("/projects");
  return { id: projectId };
}

/**
 * Apply to a project, either for a specific ROLE (roleId) or to the production
 * as a whole (roleId omitted — the shape crew calls keep using; role_id is
 * nullable precisely so that path survives).
 *
 * Two database guards get translated into friendly messages here rather than
 * leaked raw: the partial unique indexes that stop a double application
 * (23505), and the applications_check_role_project BEFORE trigger, which
 * raises if the role belongs to a different production.
 */
export async function applyToProject(
  projectId: string,
  values: ApplicationFormValues,
  roleId?: string
) {
  const parsed = applicationSchema.safeParse(values);
  if (!parsed.success) {
    return { error: "Please check your note and try again." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Your session has expired. Please log in again." };
  }

  const { error } = await supabase.from("applications").insert({
    project_id: projectId,
    applicant_id: user.id,
    note: parsed.data.note,
    role_id: roleId ?? null,
  });

  if (error) {
    if (error.code === "23505") {
      return {
        error: roleId
          ? "You've already applied for this role."
          : "You've already applied to this project.",
      };
    }
    if (error.message.includes("does not belong to project")) {
      return { error: "That role isn't part of this project." };
    }
    return { error: error.message };
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  return { success: true };
}

/** Open or close a project. RLS limits this to the owner; we pass created_by
 *  in the filter as a second line of defence. */
export async function setProjectStatus(
  projectId: string,
  status: "open" | "closed"
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Your session has expired. Please log in again." };
  }

  const { error } = await supabase
    .from("projects")
    .update({ status })
    .eq("id", projectId)
    .eq("created_by", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  return { success: true };
}
