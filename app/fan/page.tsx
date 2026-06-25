import { Rss } from "lucide-react";

// The Fan home is the Feed tab. The real follow-only feed ships once fans can
// follow at the DB level, so the body is a placeholder for now. Auth + account
// gating live in app/fan/layout.tsx, not here.
export default function FanFeedPage() {
  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <header className="flex items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Action</h1>
        <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">
          Fan
        </span>
      </header>

      <div className="mt-16 flex flex-col items-center px-6 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Rss className="size-5" strokeWidth={1.75} />
        </span>
        <p className="mt-4 font-medium">Your feed will appear here</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Follow filmmakers from Discover and their posts will show up here.
        </p>
      </div>
    </main>
  );
}
