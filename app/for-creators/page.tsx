import Link from "next/link";
import {
  IdCard,
  Briefcase,
  GraduationCap,
  Users,
  CalendarDays,
  Check,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const pillars: { icon: LucideIcon; title: string; blurb: string }[] = [
  {
    icon: IdCard,
    title: "Professional Profile",
    blurb:
      "Your canonical creative identity: reel, résumé, and credits in one polished home.",
  },
  {
    icon: Briefcase,
    title: "Project Marketplace",
    blurb:
      "Post casting calls and crew listings, or apply to the projects that fit you.",
  },
  {
    icon: GraduationCap,
    title: "Classes",
    blurb:
      "Sharpen your craft with classes, workshops, and coaches from working pros.",
  },
  {
    icon: Users,
    title: "Network & Messages",
    blurb:
      "Build connections across the industry and message collaborators directly.",
  },
  {
    icon: CalendarDays,
    title: "Events & Articles",
    blurb:
      "Host screenings and mixers or publish articles — both go live after approval.",
  },
];

const careerBullets = [
  "Every project you complete becomes a verifiable credit on your profile",
  "A track record of real work is what union eligibility is built on",
  "Grow an audience of fans who follow you before you break out",
];

export default function ForCreatorsPage() {
  return (
    <main className="flex-1">
      {/* Hero */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28 lg:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <Tag>Application Required</Tag>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            The professional side of Action
          </h1>
          <p className="mt-6 text-lg text-muted-foreground text-balance sm:text-xl">
            An application-gated network for pre-union actors, writers, and
            filmmakers. Every member is vetted, so the talent pool stays
            credible and the work stays real.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="h-12 w-full px-8 text-base sm:w-auto"
            >
              <Link href="/signup?type=creator">
                Apply as an Industry Professional
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="h-12 w-full px-8 text-base sm:w-auto"
            >
              <Link href="/for-fans">Just here to watch? Join as a Consumer</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* The five Pro pillars */}
      <section className="border-t border-border bg-muted/30">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            The full professional toolkit
          </h2>
          <p className="mx-auto mt-3 max-w-3xl text-center text-lg text-muted-foreground">
            Approved Pros get everything — discovery, work, education, and
            community — in one place.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {pillars.map(({ icon: Icon, title, blurb }) => (
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

      {/* Career arc */}
      <section className="border-t border-border">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="mx-auto max-w-3xl">
            <Card className="p-2">
              <CardHeader>
                <CardTitle className="text-xl">
                  Build credits toward SAG eligibility
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-6 text-base text-muted-foreground">
                  Action is built for the stage between film school and the
                  guilds. The work you find here isn&rsquo;t just a gig —
                  it&rsquo;s the credit history that carries you into the
                  professional industry.
                </p>
                <BulletList items={careerBullets} />
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
              <Link href="/signup?type=creator">
                Apply as an Industry Professional
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="h-12 w-full px-8 text-base sm:w-auto"
            >
              <Link href="/for-fans">Just here to watch? Join as a Consumer</Link>
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
