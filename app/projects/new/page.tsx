import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProjectForm } from "./project-form";

// Access (approved professional) is enforced by app/projects/layout.tsx.
export default function NewProjectPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
      <Link
        href="/projects"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to projects
      </Link>

      <Card className="p-2">
        <CardHeader>
          <CardTitle className="text-2xl">Post a project</CardTitle>
          <CardDescription>
            Share a role, audition, or collaboration. Approved members will see
            it in the marketplace and can apply.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProjectForm />
        </CardContent>
      </Card>
    </main>
  );
}
