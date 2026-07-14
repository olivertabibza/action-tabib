import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ClassForm } from "../class-form";

// Access (auth + approved pro) and the ProShell come from app/classes/layout.tsx,
// which wraps every /classes route — so this page doesn't re-gate or re-shell
// (unlike the events form, which lives outside the tab group).
export default function NewClassPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
      <Link
        href="/classes"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to Classes
      </Link>

      <Card className="p-2">
        <CardHeader>
          <CardTitle className="text-2xl">Teach a class</CardTitle>
          <CardDescription>
            Workshops, intensives, and coaching. We review every submission
            before it goes live on Classes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ClassForm />
        </CardContent>
      </Card>
    </main>
  );
}
