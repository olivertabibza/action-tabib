import Link from "next/link";
import { redirect } from "next/navigation";
import {
  IdCard,
  Briefcase,
  GraduationCap,
  MessageSquare,
  CalendarDays,
  Newspaper,
  Check,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const creativeBullets = [
  "Find auditions",
  "Build a professional profile",
  "Post and apply to projects",
  "Take acting classes",
  "Attend mixers and events",
];

const fanBullets = [
  "Indie film news and interviews",
  "Follow rising filmmakers",
  "Attend screenings and panels",
  "Discover new talent",
];

const features: { icon: LucideIcon; title: string; blurb: string }[] = [
  {
    icon: IdCard,
    title: "Industry Professional Profiles",
    blurb: "A polished home for your reel, résumé, and credits.",
  },
  {
    icon: Briefcase,
    title: "Project Marketplace",
    blurb: "Post roles and gigs, or apply to the ones that fit you.",
  },
  {
    icon: GraduationCap,
    title: "Acting Classes",
    blurb: "Sharpen your craft with courses from working pros.",
  },
  {
    icon: MessageSquare,
    title: "Social Feed",
    blurb: "Share updates and stay connected with your community.",
  },
  {
    icon: CalendarDays,
    title: "Events & Mixers",
    blurb: "Meet collaborators at screenings, panels, and mixers.",
  },
  {
    icon: Newspaper,
    title: "Entertainment News",
    blurb: "Indie film coverage and interviews with rising voices.",
  },
];

// Static placeholder content for the discovery section — NOT real data. Real
// articles/events and a "log in to read more" gate come in a later step.
const sampleArticles: {
  category: string;
  title: string;
  teaser: string;
  byline: string;
}[] = [
  {
    category: "Interview",
    title: "How a microbudget short found its festival run",
    teaser:
      "A first-time director on stretching $4k across three shooting days.",
    byline: "By the Action desk · 6 min read",
  },
  {
    category: "Craft",
    title: "Five casting directors on what a self-tape needs",
    teaser: "The small choices that get you to the next round — and the ones that don't.",
    byline: "By the Action desk · 4 min read",
  },
  {
    category: "Scene Report",
    title: "Inside an underground short-film circuit",
    teaser: "Where rising filmmakers screen the work that won't play the multiplex.",
    byline: "By the Action desk · 5 min read",
  },
];

const sampleEvents: {
  month: string;
  day: string;
  title: string;
  venue: string;
}[] = [
  {
    month: "JUN",
    day: "12",
    title: "Indie Shorts Night + Q&A",
    venue: "Echo Park Film Center",
  },
  {
    month: "JUN",
    day: "20",
    title: "Filmmaker Talk: making a debut feature",
    venue: "Virtual",
  },
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Logged-in users skip the marketing page and go straight to their app.
  // Mirrors the account-type dispatch in app/home/page.tsx and login.
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("account_type")
      .eq("id", user.id)
      .maybeSingle();
    redirect(profile?.account_type === "consumer" ? "/fan" : "/dashboard");
  }

  return (
    <main className="flex-1">
      {/* Hero */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28 lg:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Where the next generation of film gets made
          </h1>
          <p className="mt-6 text-lg text-muted-foreground text-balance sm:text-xl">
            A private network for pre-union actors, writers, and filmmakers —
            and the fans who follow them.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="h-12 w-full px-8 text-base sm:w-auto"
            >
              <Link href="/signup?type=creator">Apply as an Industry Professional</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 w-full px-8 text-base sm:w-auto"
            >
              <Link href="/signup?type=fan">Join as a Consumer</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Two audiences */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6 sm:pb-28">
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-2">
            <CardHeader>
              <CardTitle className="text-xl">For Industry Professionals</CardTitle>
              <CardAction>
                <Tag>Application Required</Tag>
              </CardAction>
            </CardHeader>
            <CardContent>
              <BulletList items={creativeBullets} />
            </CardContent>
          </Card>

          <Card className="p-2">
            <CardHeader>
              <CardTitle className="text-xl">For Consumers</CardTitle>
              <CardAction>
                <Tag>Open Access</Tag>
              </CardAction>
            </CardHeader>
            <CardContent>
              <BulletList items={fanBullets} />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* What's inside */}
      <section className="border-t border-border bg-muted/30">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Everything in one place
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, blurb }) => (
              <div
                key={title}
                className="rounded-xl border border-border bg-card p-6"
              >
                <Icon className="size-8 text-brand" strokeWidth={1.75} />
                <h3 className="mt-4 text-base font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{blurb}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* A peek inside — static discovery preview (placeholder content) */}
      <section className="border-t border-border">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              A peek inside Action
            </h2>
            <p className="mt-3 text-lg text-muted-foreground">
              News, interviews, and events from the indie film community.
            </p>
          </div>

          {/* From the community */}
          <h3 className="mt-12 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            From the community
          </h3>
          <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {sampleArticles.map(({ category, title, teaser, byline }) => (
              <Card key={title} className="h-full p-2">
                <CardHeader>
                  <Tag>{category}</Tag>
                  <CardTitle className="mt-3 text-lg leading-snug">
                    {title}
                  </CardTitle>
                  <CardDescription className="mt-1.5">{teaser}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{byline}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Happening soon */}
          <h3 className="mt-12 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Happening soon
          </h3>
          <div className="mt-5 grid gap-6 sm:grid-cols-2">
            {sampleEvents.map(({ month, day, title, venue }) => (
              <Card key={title} className="h-full p-2">
                <CardContent className="flex items-center gap-4">
                  <span className="flex size-14 shrink-0 flex-col items-center justify-center rounded-lg bg-brand/10 text-brand">
                    <span className="text-[0.65rem] font-semibold tracking-wide uppercase">
                      {month}
                    </span>
                    <span className="text-xl leading-none font-bold">{day}</span>
                  </span>
                  <div>
                    <p className="text-base font-semibold leading-snug">
                      {title}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{venue}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Engagement hook — stands in for the future content gate */}
          <div className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="h-12 w-full px-8 text-base sm:w-auto"
            >
              <Link href="/signup">Join to see more</Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="lg"
              className="h-12 w-full px-8 text-base sm:w-auto"
            >
              <Link href="/login">Already a member? Sign in</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-3">
            <span>© 2026 Action</span>
            <span className="rounded-full border border-border px-2.5 py-0.5 text-xs">
              Working title — coming soon
            </span>
          </div>
          <a
            href="https://action-web-kappa.vercel.app"
            className="font-medium text-foreground transition-colors hover:text-brand"
            target="_blank"
            rel="noopener noreferrer"
          >
            View business plan →
          </a>
        </div>
      </footer>
    </main>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand">
      {children}
    </span>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 text-base">
          <Check className="mt-0.5 size-5 shrink-0 text-brand" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
