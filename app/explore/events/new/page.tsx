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
import { EventForm } from "../event-form";

// This page lives outside the (tab) route group, so it gates access itself.
export default async function NewEventPage() {
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
            <CardTitle className="text-2xl">Host an event</CardTitle>
            <CardDescription>
              Screenings, Q&amp;As, panels, and mixers. We review every
              submission before it goes live on Explore.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EventForm />
          </CardContent>
        </Card>
      </main>
    </ProShellServer>
  );
}
