import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ProShellServer } from "@/components/ProShellServer";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireApprovedProPage } from "../../authoring-gate";
import { ArticleForm } from "../article-form";

// This page lives outside the (tab) route group, so it gates access itself.
export default async function NewArticlePage() {
  await requireApprovedProPage();

  return (
    <ProShellServer>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <Link
          href="/explore"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to Explore
        </Link>

        <Card className="p-2">
          <CardHeader>
            <CardTitle className="text-2xl">Write an article</CardTitle>
            <CardDescription>
              Interviews, craft pieces, scene reports, and news. We review every
              submission before it goes live on Explore.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ArticleForm />
          </CardContent>
        </Card>
      </main>
    </ProShellServer>
  );
}
