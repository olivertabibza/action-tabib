import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { resolveBackLink } from "@/lib/back-link";
import { titleCase } from "@/lib/marketplace";
import { articleCategoryLabel } from "@/lib/content";
import { Avatar } from "@/components/Avatar";
import { SaveButton } from "../../saved/save-button";

// PUBLIC page — no shell, no auth redirect. Published articles are open-access
// (RLS exposes published rows to anon), so logged-out fans can read them. We
// still fetch the viewer (if any) to allow the author/admin to preview a draft.

type Person = { display_name: string | null; role: string | null };

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
  const { href: backHref, label: backLabel } = await resolveBackLink(
    `/explore/articles/${id}`,
    { href: fallbackHref, label: fallbackLabel }
  );

  const { data: article } = await supabase
    .from("articles")
    .select(
      "id, title, category, excerpt, body, created_at, status, created_by, author:profiles!articles_created_by_fkey(display_name, role)"
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

  // Supabase types embedded relations as arrays; this FK is to-one at runtime.
  const author = article.author as unknown as Person | null;
  const authorName = author?.display_name || "the Action desk";
  const published = new Date(article.created_at).toLocaleDateString(undefined, {
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
        <Avatar name={authorName} className="size-9" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-medium">
            {authorName}
            {author?.role ? ` · ${titleCase(author.role)}` : ""}
          </p>
          <p className="text-muted-foreground">{published}</p>
        </div>
        <SaveButton
          itemType="article"
          itemId={article.id}
          initialSaved={initialSaved}
          loggedIn={!!user}
        />
      </div>

      {/* TODO: a NYT-style "log in to keep reading" metering gate will wrap this
          body later — counting an anonymous reader's free articles and prompting
          them to sign up partway through. For now the full body is open. */}
      <article className="mt-8 whitespace-pre-wrap text-base leading-relaxed text-foreground/90">
        {article.body || article.excerpt || "This article has no content yet."}
      </article>
    </main>
  );
}
