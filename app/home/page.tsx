import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Clock, UserRound } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const greetingName =
    profile?.display_name || user.email?.split("@")[0] || "there";
  const isProfessional = profile?.account_type === "professional";
  const isPending =
    isProfessional && profile?.application_status === "pending";

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        Welcome back, {greetingName}.
      </h1>
      <p className="mt-3 text-lg text-muted-foreground">
        This is your home on Action. More is coming soon.
      </p>

      {isPending && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-4">
          <Clock className="mt-0.5 size-5 shrink-0 text-brand" />
          <div>
            <p className="font-medium">Your application is under review</p>
            <p className="mt-1 text-sm text-muted-foreground">
              We review every industry professional personally. In the meantime
              you can fill out your profile so it&rsquo;s ready to go.
            </p>
          </div>
        </div>
      )}

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        <Link href="/profile" className="group">
          <Card className="h-full p-2 transition-colors group-hover:border-brand">
            <CardHeader>
              <span className="flex size-11 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <UserRound className="size-5" strokeWidth={1.75} />
              </span>
              <CardTitle className="mt-4 flex items-center justify-between text-lg">
                Your profile
                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </CardTitle>
              <CardDescription>
                Edit your name, headline, and bio, and view your uploaded
                portfolio.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Card className="h-full p-2 opacity-70">
          <CardHeader>
            <span className="flex size-11 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Clock className="size-5" strokeWidth={1.75} />
            </span>
            <CardTitle className="mt-4 text-lg">More coming soon</CardTitle>
            <CardDescription>
              Projects, classes, events, and the social feed are on the way.
            </CardDescription>
          </CardHeader>
          <CardContent />
        </Card>
      </div>
    </main>
  );
}
