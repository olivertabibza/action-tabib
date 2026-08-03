import Link from "next/link";
import {
  Heart,
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

const features: { icon: LucideIcon; title: string; blurb: string }[] = [
  {
    icon: Heart,
    title: "Follow filmmakers you love",
    blurb:
      "Back emerging actors, writers, and directors before they break out, and keep up with their work in a feed that's strictly the people you follow.",
  },
  {
    icon: CalendarDays,
    title: "Attend screenings & Q&As",
    blurb:
      "RSVP to screenings, filmmaker Q&As, and festivals — the in-person side of the indie film community.",
  },
  {
    icon: Newspaper,
    title: "Read interviews & articles",
    blurb:
      "Original interviews and indie film coverage, with a spotlight on the rising voices you won't find in the trades.",
  },
];

const fanBullets = [
  "Free forever — sign up and start following in minutes",
  "A follow-only feed with just the filmmakers you choose",
  "Events, interviews, and articles all in one place",
];

export default function ForFansPage() {
  return (
    <main className="flex-1">
      {/* Hero */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28 lg:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <Tag>Open Access</Tag>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Your window into emerging film
          </h1>
          <p className="mt-6 text-lg text-muted-foreground text-balance sm:text-xl">
            The free, open side of Action. No application, no gate — just the
            filmmakers, screenings, and stories of the next generation of film.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="h-12 w-full px-8 text-base sm:w-auto"
            >
              <Link href="/signup?type=fan">Join as a Consumer</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="h-12 w-full px-8 text-base sm:w-auto"
            >
              <Link href="/for-creators">
                Work in the industry? Apply for a Pro account
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* What fans get */}
      <section className="border-t border-border bg-muted/30">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Everything a film fan needs
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

      {/* Built for watching, not working */}
      <section className="border-t border-border">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="mx-auto max-w-3xl">
            <Card className="p-2">
              <CardHeader>
                <CardTitle className="text-xl">
                  Built for watching, not working
                </CardTitle>
                <CardAction>
                  <Tag>Free</Tag>
                </CardAction>
              </CardHeader>
              <CardContent>
                <p className="mb-6 text-base text-muted-foreground">
                  Classes, the project marketplace, and casting are professional
                  tools, so they live on the Pro side. A Fan account stays
                  simple on purpose: no résumés, no applications — just the
                  best seat in the house for emerging film.
                </p>
                <BulletList items={fanBullets} />
              </CardContent>
            </Card>
          </div>

          {/* Bottom CTA */}
          <div className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="h-12 w-full px-8 text-base sm:w-auto"
            >
              <Link href="/signup?type=fan">Join as a Consumer</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="h-12 w-full px-8 text-base sm:w-auto"
            >
              <Link href="/for-creators">
                Work in the industry? Apply for a Pro account
              </Link>
            </Button>
          </div>
        </div>
      </section>
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
