import Link from "next/link";
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
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
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

export default function Home() {
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
              <Link href="/signup?type=creator">Join as an Industry Professional</Link>
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
