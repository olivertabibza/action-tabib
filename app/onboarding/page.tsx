import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { OnboardingFlow } from "./onboarding-flow";

export default async function OnboardingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protected route — onboarding only makes sense for a signed-in user.
  if (!user) {
    redirect("/signup");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-20">
      <OnboardingFlow userId={user.id} email={user.email ?? ""} />
    </main>
  );
}
