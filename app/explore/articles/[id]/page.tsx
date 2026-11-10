import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { viewerTimeZone } from "@/lib/datetime";
import { resolveBackLink } from "@/lib/back-link";
import { publicPeople } from "@/lib/public-people";
import { titleCase } from "@/lib/marketplace";
import { articleCategoryLabel } from "@/lib/content";
import { Avatar } from "@/components/Avatar";
import { SaveButton } from "../../saved/save-button";
import { ArticleGateCard, FreeArticleBanner } from "../meter";
import { MeterStamp } from "../meter-stamp";

// Tab and history title: the article's own name (UX B-32). RLS applies, so
// anything the viewer can't see falls back to "Article".
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("articles")
    .select("title")
    .eq("id", id)
    .maybeSingle();
  return { title: data?.title || "Article" };
}

// PUBLIC page — no shell, no auth redirect. Published articles are open-access
// (RLS exposes published rows to anon), so logged-out fans can read them. We
// still fetch the viewer (if any) to allow the author/admin to preview a draft.

/**
 * The teaser shown above the gate. Cut after the second paragraph, or at a
 * word boundary around ~500 characters — whichever is shorter. This runs on
 * the SERVER so the gated response never contains the full body (a CSS-only
 * hide would leave the text one view-source away).
 */
function teaserFrom(body: string): string {
  const byParagraph = body.split(/\n\s*\n/).slice(0, 2).join("\n\n");
  if (byParagraph.length <= 550) return byParagraph;
  const slice = byParagraph.slice(0, 550);
  const lastSpace = slice.lastIndexOf(" ");
  return slice.slice(0, lastSpace > 450 ? lastSpace : 550).trimEnd() + "…";
}

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Back-link target depends on the viewer: this page is public and shell-less,
  // and /explore (the Pro Explore tab) redirects any non-approved-pro away — so
  // sending a fan there bounces them to Pro home, and sending an anon there
  // forces a login on an open-access page. Approved pros → Pro Explore; fans →
  // the Fan app's Explore; logged-out → the landing page. This is the fallback:
  // when the viewer arrived from another in-app page we send them back there
  // instead (resolveBackLink, via the referer).
  let fallbackHref = "/";
  let fallbackLabel = "Back";
  if (user) {
    const { data: viewer } = await supabase
      .from("profiles")
      .select("account_type, application_status")
      .eq("id", user.id)
      .maybeSingle();
    if (
      viewer?.account_type === "professional" &&
      viewer?.application_status === "approved"
    ) {
      fallbackHref = "/explore";
      fallbackLabel = "Back to Explore";
    } else {
      fallbackHref = "/fan/explore";
      fallbackLabel = "Back to Explore";
    }
  }
  // A logged-out visitor always goes back to the landing page: the referer can
  // be a members-only page (or /login), which would send them to log in (UX B-28).
  const fallback = { href: fallbackHref, label: fallbackLabel };
  const { href: backHref, label: backLabel } = user
    ? await resolveBackLink(`/explore/articles/${id}`, fallback)
    : fallback;

  const { data: article } = await supabase
    .from("articles")
    .select(
      "id, title, category, excerpt, body, created_at, status, created_by"
    )
    .eq("id", id)
    .maybeSingle();

  if (!article) {
    notFound();
  }

  // Published is public. A non-published article is visible only to its author
  // or an admin (RLS already enforces this on read; this is the in-app echo).
  const isAuthor = !!user && article.created_by === user.id;
  let isAdmin = false;
  if (user && !isAuthor && article.status !== "published") {
    const { data: me } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();
    isAdmin = !!me?.is_admin;
  }
  if (article.status !== "published" && !isAuthor && !isAdmin) {
    notFound();
  }

  // Whether the viewer has saved this article (logged-in only; anon → false).
  let initialSaved = false;
  if (user) {
    const { data: mySave } = await supabase
      .from("saved_items")
      .select("id")
      .eq("user_id", user.id)
      .eq("item_type", "article")
      .eq("item_id", id)
      .maybeSingle();
    initialSaved = !!mySave;
  }

  // Article meter (logged-out readers only): MeterStamp records the FIRST
  // article a visitor opens in the `article_meter` cookie (stampArticleMeter).
  // That article stays fully readable on every visit; any other id gets a
  // server-side teaser and the gate. A missing cookie means this IS the first
  // view, so it's the free article. Logged-in viewers never gate.
  let isFreeArticle = false;
  let gated = false;
  if (!user) {
    const meter = (await cookies()).get("article_meter")?.value;
    isFreeArticle = !meter || meter === id;
    gated = !isFreeArticle;
  }

  const author = (await publicPeople(supabase, [article.created_by])).get(
    article.created_by
  );
  const authorName = author?.display_name || "the Action desk";
  const tz = await viewerTimeZone();
  const published = new Date(article.created_at).toLocaleDateString(undefined, {
    timeZone: tz,
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
      <Link
        href={backHref}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {backLabel}
      </Link>

      <p className="text-sm font-medium text-brand">
        {articleCategoryLabel(article.category)}
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
        {article.title}
      </h1>

      <div className="mt-5 flex items-center gap-3">
        <Avatar
          name={authorName}
          photoPath={author?.avatar_path}
          className="size-9"
        />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-medium">
            {authorName}
            {author?.role ? ` · ${titleCase(author.role)}` : ""}
          </p>
          <p className="text-muted-foreground">{published}</p>
        </div>
        {/* Visitors have nowhere to save to; Save only sent them to log in. */}
        {user && (
          <SaveButton
            itemType="article"
            itemId={article.id}
            initialSaved={initialSaved}
            loggedIn
          />
        )}
      </div>

      {isFreeArticle && (
        <>
          <MeterStamp articleId={article.id} />
          <FreeArticleBanner />
        </>
      )}

      {gated ? (
        <>
          <div className="relative">
            <article className="mt-8 whitespace-pre-wrap text-base leading-relaxed text-foreground/90">
              {teaserFrom(
                article.body ||
                  article.excerpt ||
                  "This article has no content yet."
              )}
            </article>
            {/* Fade the teaser into the gate. */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" />
          </div>
          <ArticleGateCard />
        </>
      ) : (
        <article className="mt-8 whitespace-pre-wrap text-base leading-relaxed text-foreground/90">
          {article.body || article.excerpt || "This article has no content yet."}
        </article>
      )}
    </main>
  );
}
