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

  const { data, error } = await supabase
    .from("projects")
    .insert({ created_by: user.id, ...parsed.data })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/projects");
  return { id: data.id as string };
}

/** Apply to a project. The unique (project_id, applicant_id) index stops
 *  double applications; we translate that into a friendly message. */
export async function applyToProject(
  projectId: string,
  values: ApplicationFormValues
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
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "You've already applied to this project." };
    }
    return { error: error.message };
  }

  revalidatePath(`/projects/${projectId}`);
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
