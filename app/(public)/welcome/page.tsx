import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function WelcomePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-[#0a0e14] px-4 py-24 text-center text-white">
      <div className="max-w-xl">
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          Welcome to Action.
        </h1>
        <p className="mt-5 text-lg text-white/70 text-balance">
          You&rsquo;re in. Indie film&rsquo;s best kept secret just got a little
          less secret. Content and creator profiles are coming soon &mdash; stay
          tuned.
        </p>
        <Button asChild size="lg" className="mt-8 h-11 px-6 text-base">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </div>
  );
}
