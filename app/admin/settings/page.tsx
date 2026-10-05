import { createClient } from "@/lib/supabase/server";
import { AdminNav } from "../admin-nav";
import type { AutoApproveKind } from "../schema";
import { AutoApproveRow } from "./auto-approve-row";

const ROWS: {
  kind: AutoApproveKind;
  label: string;
  noun: string;
  note?: string;
}[] = [
  {
    kind: "pro_applications",
    label: "Pro applications",
    noun: "applications",
    note: "While this is on, anyone who signs up as a professional is approved instantly. Turn it off after the demo.",
  },
  { kind: "classes", label: "Classes", noun: "classes" },
  { kind: "events", label: "Events", noun: "events" },
  { kind: "articles", label: "Articles", noun: "articles" },
];

export default async function AdminSettingsPage() {
  const supabase = await createClient();

  const [settingsRes, proRes, classRes, eventRes, articleRes] = await Promise.all([
    supabase
      .from("platform_settings")
      .select(
        "auto_approve_pro_applications, auto_approve_classes, auto_approve_events, auto_approve_articles"
      )
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("account_type", "professional")
      .eq("application_status", "pending"),
    supabase
      .from("classes")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("articles")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  const settings = settingsRes.data as Record<string, boolean> | null;
  const pendingCount: Record<AutoApproveKind, number> = {
    pro_applications: proRes.count ?? 0,
    classes: classRes.count ?? 0,
    events: eventRes.count ?? 0,
    articles: articleRes.count ?? 0,
  };

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Admin</h1>
      <p className="mt-2 text-muted-foreground">
        Auto-approve new submissions, or clear a review queue in one go.
      </p>

      <div className="mt-8">
        <AdminNav active="settings" />
      </div>

      {settingsRes.error || !settings ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Couldn&rsquo;t load settings
          {settingsRes.error ? `: ${settingsRes.error.message}` : "."}
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {ROWS.map((row) => (
            <AutoApproveRow
              key={row.kind}
              kind={row.kind}
              label={row.label}
              noun={row.noun}
              note={row.note}
              enabled={settings[`auto_approve_${row.kind}`] === true}
              pending={pendingCount[row.kind]}
            />
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-1 text-sm text-muted-foreground">
        <p>
          Projects and class enrollments go live immediately — there&rsquo;s no
          review step to auto-approve.
        </p>
        <p>Turning a switch off doesn&rsquo;t un-approve anything.</p>
      </div>
    </main>
  );
}
