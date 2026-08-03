import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export default async function PendingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = user?.email ?? "your email";

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-[#0a0e14] px-4 py-24 text-center text-white">
      <div className="max-w-xl">
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          You&rsquo;re on the list.
        </h1>
        <p className="mt-5 text-lg text-white/70 text-balance">
          We review every application personally. We&rsquo;ll email you at{" "}
          <span className="font-medium text-white">{email}</span> when
          you&rsquo;re approved. In the meantime, feel free to explore what
          Action is all about.
        </p>
        <Button asChild size="lg" className="mt-8 h-11 px-6 text-base">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </div>
  );
}
