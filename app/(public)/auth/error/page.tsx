import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function AuthErrorPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-24 text-center">
      <div className="max-w-md">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Something went wrong
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          We couldn&apos;t confirm your account. The link may have expired or
          already been used.
        </p>
      </div>
      <Button asChild size="lg" className="h-11 px-8 text-base">
        <Link href="/signup">Try signing up again</Link>
      </Button>
    </main>
  );
}
