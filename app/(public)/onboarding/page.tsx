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

  // Set at signup from the button they tapped (UX B-04 / PX F07), so they
  // don't have to answer "Who are you?" twice. Only picks the opening step;
  // they can still go back and choose the other account type.
  const intended = user.user_metadata?.intended_account;
  const initialStep =
    intended === "fan"
      ? "consumer"
      : intended === "creator"
        ? "professional"
        : "choose";

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-20">
      <OnboardingFlow
        userId={user.id}
        email={user.email ?? ""}
        initialStep={initialStep}
      />
    </main>
  );
}
