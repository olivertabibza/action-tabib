"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
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

/**
 * Article meter, logged-out readers only: the first article a visitor actually
 * opens becomes their one free article. The cookie stores WHICH article, so
 * revisiting it stays free and the article page gates every other id.
 *
 * Set from the page after it mounts (MeterStamp), never in proxy.ts: the proxy
 * also runs for link prefetches, so a visitor scrolling past a list of
 * articles used up their free read on whichever link was prefetched first and
 * hit the paywall on the article they actually opened (UX B-28).
 */
export async function stampArticleMeter(articleId: string) {
  if (!/^[0-9a-f-]{1,64}$/i.test(articleId)) return;

  const jar = await cookies();
  if (jar.get("article_meter")) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return;

  jar.set("article_meter", articleId, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // ~30 days
    path: "/",
  });
}
