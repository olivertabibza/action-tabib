import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { ProShell } from "@/components/ProShell";

/**
 * Access gate for Pro classes, enforced in one place (mirrors
 * app/messages/layout.tsx):
 *   - logged-out                   → /login (the proxy also guards this)
 *   - not an approved professional → /home
 *   - approved pro                 → render inside the Pro shell
 */
export default async function ClassesLayout({
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

  if (
    profile?.account_type !== "professional" ||
    profile?.application_status !== "approved"
  ) {
    redirect("/home");
  }

  return <ProShell>{children}</ProShell>;
}
