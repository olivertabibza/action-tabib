"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { articleSchema, type ArticleFormValues } from "./schema";

/**
 * Write an article. Inserts a row owned by the signed-in user; RLS also requires
 * an approved professional and forces the default 'pending' status, so this
 * can't self-publish. On success we redirect back to /explore with a flag the
 * tab turns into a "pending review" banner.
 */
export async function createArticle(values: ArticleFormValues) {
  const parsed = articleSchema.safeParse(values);
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

  const { error } = await supabase.from("articles").insert({
    created_by: user.id,
    ...parsed.data,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/explore");
  redirect("/explore?submitted=article");
}
