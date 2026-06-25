import { LogoutButton } from "@/components/LogoutButton";

// Skeleton for the Profile tab — real content (fan profile, following count,
// upgrade-to-Pro prompt, saved items) lands next, matched to fan-profile.png.
export default function FanProfilePage() {
  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
      <p className="mt-2 text-sm text-muted-foreground">Coming soon.</p>

      {/* Mobile-only logout — desktop has the sidebar control instead. */}
      <LogoutButton className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50 md:hidden" />
    </main>
  );
}
