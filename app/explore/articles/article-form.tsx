"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { ARTICLE_CATEGORIES, articleCategoryLabel } from "@/lib/content";
import { articleSchema, type ArticleFormValues } from "./schema";
import { createArticle } from "./actions";

export function ArticleForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ArticleFormValues>({
    resolver: zodResolver(articleSchema),
    defaultValues: {
      title: "",
      category: "interview",
      excerpt: "",
      body: "",
    },
  });

  function onSubmit(values: ArticleFormValues) {
    setServerError(null);
    startTransition(async () => {
      // On success the action redirects to /explore, so control returns here
      // only when something went wrong.
      const result = await createArticle(values);
      if (result?.error) {
        setServerError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          placeholder="e.g. On the set of an indie feature"
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? "article-title-error" : undefined}
          {...register("title")}
        />
        {errors.title && (
          <p id="article-title-error" className="text-sm text-destructive">
            {errors.title.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="category">Category</Label>
        <NativeSelect
          id="category"
          aria-invalid={!!errors.category}
          aria-describedby={
            errors.category ? "article-category-error" : undefined
          }
          {...register("category")}
        >
          {ARTICLE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {articleCategoryLabel(c)}
            </option>
          ))}
        </NativeSelect>
        {errors.category && (
          <p id="article-category-error" className="text-sm text-destructive">
            {errors.category.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="excerpt">Excerpt</Label>
        <Input
          id="excerpt"
          placeholder="A one-line teaser shown on the Explore card"
          aria-invalid={!!errors.excerpt}
          aria-describedby={
            errors.excerpt ? "article-excerpt-error" : undefined
          }
          {...register("excerpt")}
        />
        {errors.excerpt && (
          <p id="article-excerpt-error" className="text-sm text-destructive">
            {errors.excerpt.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="body">Article</Label>
        <Textarea
          id="body"
          rows={12}
          placeholder="Write the full piece here."
          aria-invalid={!!errors.body}
          aria-describedby={errors.body ? "article-body-error" : undefined}
          {...register("body")}
        />
        {errors.body && (
          <p id="article-body-error" className="text-sm text-destructive">
            {errors.body.message}
          </p>
        )}
      </div>

      {serverError && (
        <p
          role="alert"
          className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {serverError}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {pending ? "Submitting…" : "Submit for review"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/explore")}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
