"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  applicationSchema,
  projectSchema,
  type ApplicationFormValues,
  type ProjectFormValues,
} from "./schema";

/**
 * Create a project owned by the signed-in user. Row Level Security also
 * enforces that only an approved professional can insert, but we re-read the
 * session here so the client can never set `created_by` to someone else.
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

  // "any" is mutually exclusive with specific disciplines (the form enforces
  // this too, but never trust the client). The legacy single-value column keeps
  // being written as the first entry for backward compatibility.
  const disciplines = parsed.data.disciplines.includes("any")
    ? ["any"]
    : parsed.data.disciplines;

  const { data, error } = await supabase
    .from("projects")
    .insert({
      created_by: user.id,
      ...parsed.data,
      disciplines,
      discipline: disciplines[0],
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/projects");
  return { id: data.id as string };
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
