import { redirect } from "next/navigation";
import { Clock, Lock } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { ProShell } from "@/components/ProShell";

/**
 * Access gate for the whole marketplace. The project pages below assume an
 * approved industry professional; this layout enforces that in one place:
 *   - logged-out          → /login (the proxy also guards this)
 *   - consumer ("fan")    → "this is for professionals" message
 *   - pending professional→ "under review" message
 *   - approved pro        → the actual page
 */
export default async function ProjectsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_type, application_status")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.account_type !== "professional") {
    return (
      <ProShell>
        <Gate
          icon={<Lock className="size-5 text-brand" />}
          title="The project marketplace is for industry professionals"
          body="Projects and auditions are posted by and for people working in film. Your account is set up as a member of the community, so this section isn't available to you."
        />
      </ProShell>
    );
  }

  if (profile?.application_status !== "approved") {
    return (
      <ProShell>
        <Gate
          icon={<Clock className="size-5 text-brand" />}
          title="Your application is under review"
          body="We review every industry professional personally. We'll email you when you're approved — then the project marketplace will open up here."
        />
      </ProShell>
    );
  }

  return <ProShell>{children}</ProShell>;
}

function Gate({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-20 sm:px-6">
      <div className="flex flex-col items-start gap-4 rounded-xl bg-card p-8 ring-1 ring-foreground/10">
        <span className="flex size-11 items-center justify-center rounded-lg bg-brand/10">
          {icon}
        </span>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{body}</p>
      </div>
    </main>
  );
}
