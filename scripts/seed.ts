/**
 * Database seed — demo Industry Professionals, projects, applications, events,
 * and articles.
 *
 * SERVER-ONLY. Run with `npm run seed` (which loads .env.local via tsx's
 * --env-file). It uses the Supabase SECRET (service-role) key, which bypasses
 * RLS and can create confirmed auth users — so this file must NEVER be
 * imported from anything under app/ or any client code.
 *
 * Safe to re-run: seed accounts are identified by the @actionseed.test email
 * pattern. Existing seed auth users are reused (password reset to the shared
 * one); seed-owned projects, events, and articles are deleted first (projects
 * cascade their applications) before everything is re-inserted. Real, non-seed
 * data is never touched.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ── Config ──────────────────────────────────────────────────────────────────

const SEED_DOMAIN = "actionseed.test";
const SHARED_PASSWORD = "ActionSeed!2026";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET_KEY =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SECRET_KEY) {
  console.error(
    [
      "Missing required env vars.",
      "",
      "  NEXT_PUBLIC_SUPABASE_URL    " + (SUPABASE_URL ? "ok" : "MISSING"),
      "  SUPABASE_SECRET_KEY         " + (SECRET_KEY ? "ok" : "MISSING"),
      "",
      "Add the Supabase SECRET (service-role) key to .env.local, e.g.:",
      "  SUPABASE_SECRET_KEY=sb_secret_...   (Dashboard → Project Settings → API keys)",
      "",
      "Use the secret/service-role key — NOT the publishable/anon key.",
    ].join("\n")
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Seed data ─────────────────────────────────────────────────────────────--

type Discipline =
  | "actor"
  | "writer"
  | "director"
  | "producer"
  | "cinematographer"
  | "editor"
  | "composer";

type ProAccount = {
  key: string; // local-part of the seed email, e.g. "actor-1"
  discipline: Discipline;
  status: "approved" | "pending";
  display_name: string;
  headline: string;
  bio: string;
};

const PROS: ProAccount[] = [
  // ── 8 approved ──
  {
    key: "actor-1",
    discipline: "actor",
    status: "approved",
    display_name: "Mara Velez",
    headline: "Theatre-trained lead, drawn to character-driven indie work",
    bio: "NYU grad with five festival shorts and two regional stage seasons. Comfortable in intimate two-handers and grounded naturalism.",
  },
  {
    key: "actor-2",
    discipline: "actor",
    status: "approved",
    display_name: "Desmond Okafor",
    headline: "Physical actor and improviser, comedy to quiet drama",
    bio: "Background in clown and movement work. Loves low-budget shoots where everyone wears three hats.",
  },
  {
    key: "writer-1",
    discipline: "writer",
    status: "approved",
    display_name: "Priya Nair",
    headline: "Screenwriter focused on contained, dialogue-led stories",
    bio: "Two optioned shorts and a pilot in the BlackList top 10%. Writes scrappy single-location scripts built for indie budgets.",
  },
  {
    key: "director-1",
    discipline: "director",
    status: "approved",
    display_name: "Léo Marchetti",
    headline: "Director — naturalistic drama with a documentary edge",
    bio: "Came up shooting music videos. Now directing a debut micro-budget feature shot on weekends.",
  },
  {
    key: "producer-1",
    discipline: "producer",
    status: "approved",
    display_name: "Hana Sørensen",
    headline: "Line producer who actually finishes the films",
    bio: "Scheduling, budgets, and keeping crews fed. Five shorts and one feature delivered on time.",
  },
  {
    key: "cinematographer-1",
    discipline: "cinematographer",
    status: "approved",
    display_name: "Theo Adeyemi",
    headline: "DP — available light, anamorphic, lots of patience",
    bio: "Owns a small lighting kit and a beat-up set of vintage glass. Happiest on location at golden hour.",
  },
  {
    key: "editor-1",
    discipline: "editor",
    status: "approved",
    display_name: "Yuki Tanaka",
    headline: "Editor cutting narrative shorts and music docs",
    bio: "Resolve and Premiere. Fast on selects, obsessive about rhythm and sound design handoff.",
  },
  {
    key: "composer-1",
    discipline: "composer",
    status: "approved",
    display_name: "Nora Bellini",
    headline: "Composer — modular synth meets chamber strings",
    bio: "Scores three to four shorts a year. Writes to picture and turns around stems quickly.",
  },
  // ── 3 pending (full profiles so the admin dashboard has something to review) ──
  {
    key: "director-2",
    discipline: "director",
    status: "pending",
    display_name: "Sami Haddad",
    headline: "First-time director with a finished proof-of-concept",
    bio: "Shot a 6-minute concept reel for a coming-of-age feature. Looking for collaborators and a producer to package it.",
  },
  {
    key: "writer-2",
    discipline: "writer",
    status: "pending",
    display_name: "Imani Brooks",
    headline: "Playwright crossing over into screenwriting",
    bio: "Three produced stage plays. New to film and eager to adapt a one-act into a short.",
  },
  {
    key: "cinematographer-2",
    discipline: "cinematographer",
    status: "pending",
    display_name: "Rui Costa",
    headline: "Camera operator stepping up to DP",
    bio: "Five years as a 1st AC on commercials. Ready to shoot narrative and building a reel.",
  },
];

type ProjectSpec = {
  title: string;
  ownerKey: string; // must be an approved pro
  discipline: Discipline | "any";
  description: string;
  location: string;
  compensation: "paid" | "unpaid" | "deferred";
  status: "open" | "closed";
};

const PROJECTS: ProjectSpec[] = [
  {
    title: "Last Train to Lisbon",
    ownerKey: "director-1",
    discipline: "actor",
    description:
      "Casting a lead (30s, any background) for a contained drama set over one night in a near-empty train station. Three shoot days, scripted, SAG-friendly.",
    location: "Brooklyn, NY",
    compensation: "paid",
    status: "open",
  },
  {
    title: "The Quiet Hours",
    ownerKey: "director-1",
    discipline: "cinematographer",
    description:
      "Need a DP for a slow-cinema short shot mostly in available light. Vintage glass a plus. Two weekends, deferred + meals + festival credit.",
    location: "Hudson Valley, NY",
    compensation: "deferred",
    status: "open",
  },
  {
    title: "Neon Saints",
    ownerKey: "producer-1",
    discipline: "editor",
    description:
      "Looking for an editor to cut a 12-minute neo-noir short. ~6 hours of footage, Resolve preferred. Paid flat rate, remote OK.",
    location: "Remote",
    compensation: "paid",
    status: "open",
  },
  {
    title: "Coastline",
    ownerKey: "producer-1",
    discipline: "composer",
    description:
      "Feature documentary about a fishing town needs an original score — restrained, textural, ~25 min of music. Paid, generous timeline.",
    location: "Remote",
    compensation: "paid",
    status: "open",
  },
  {
    title: "Staged",
    ownerKey: "writer-1",
    discipline: "director",
    description:
      "Six-episode comedy web series about a failing community theatre. Scripts done. Seeking a director who loves ensemble work. Unpaid, profit-share if it sells.",
    location: "Chicago, IL",
    compensation: "unpaid",
    status: "open",
  },
  {
    title: "Macro",
    ownerKey: "cinematographer-1",
    discipline: "actor",
    description:
      "Experimental one-shot short, single performer, lots of close work. Looking for an actor comfortable with stillness and improvisation. Unpaid, one day.",
    location: "Los Angeles, CA",
    compensation: "unpaid",
    status: "open",
  },
  {
    title: "Cut to Black",
    ownerKey: "editor-1",
    discipline: "writer",
    description:
      "I have footage and an idea but no script — looking for a writer to shape a found-footage short in the edit. Deferred, collaborative credit.",
    location: "Remote",
    compensation: "deferred",
    status: "open",
  },
  {
    title: "Resonance",
    ownerKey: "composer-1",
    discipline: "producer",
    description:
      "Concept short built around a live score. Need a producer to lock a venue, schedule, and a tiny crew. Unpaid, strong reel piece.",
    location: "Austin, TX",
    compensation: "unpaid",
    status: "open",
  },
  {
    title: "Two-Hander",
    ownerKey: "actor-1",
    discipline: "actor",
    description:
      "Self-produced two-person dialogue piece — seeking a second actor to develop and perform it with me. Deferred, equal creative footing.",
    location: "Brooklyn, NY",
    compensation: "deferred",
    status: "open",
  },
  {
    title: "Open Mic",
    ownerKey: "actor-2",
    discipline: "writer",
    description:
      "Stand-up-adjacent short set at an open mic night. Looking for a writer to punch up a loose outline into a tight 8 pages. Unpaid, fast and fun.",
    location: "Los Angeles, CA",
    compensation: "unpaid",
    status: "open",
  },
  {
    title: "Midnight Diner",
    ownerKey: "director-1",
    discipline: "any",
    description:
      "Anthology short set in a 24-hour diner. Building a full crew — reach out with your role and reel. Paid day rates, three nights.",
    location: "Newark, NJ",
    compensation: "paid",
    status: "open",
  },
  {
    title: "Archive (wrapped)",
    ownerKey: "producer-1",
    discipline: "editor",
    description:
      "Short doc assembled from family archive footage. Picture is locked — posting closed, kept up for reference.",
    location: "Remote",
    compensation: "paid",
    status: "closed",
  },
];

type ApplicationSpec = {
  projectTitle: string;
  applicantKey: string; // must be an approved pro, must not own the project
  note: string;
};

const APPLICATIONS: ApplicationSpec[] = [
  {
    projectTitle: "Last Train to Lisbon",
    applicantKey: "actor-1",
    note: "This is exactly my lane — quiet, contained, night work. Reel and availability ready.",
  },
  {
    projectTitle: "Last Train to Lisbon",
    applicantKey: "actor-2",
    note: "Love a one-location piece. Free those weekends and based nearby.",
  },
  {
    projectTitle: "The Quiet Hours",
    applicantKey: "cinematographer-1",
    note: "Available-light slow cinema is my favorite thing to shoot. I have vintage glass we could use.",
  },
  {
    projectTitle: "Neon Saints",
    applicantKey: "editor-1",
    note: "Neo-noir is right up my alley and I cut in Resolve daily. Can start this week.",
  },
  {
    projectTitle: "Coastline",
    applicantKey: "composer-1",
    note: "Textural and restrained is exactly how I write. Would love to see a rough cut.",
  },
  {
    projectTitle: "Staged",
    applicantKey: "director-1",
    note: "Ensemble comedy is a nice change of pace for me. Happy to shoot a test scene first.",
  },
  {
    projectTitle: "Macro",
    applicantKey: "actor-1",
    note: "Stillness and improv — yes. One day works perfectly with my schedule.",
  },
  {
    projectTitle: "Macro",
    applicantKey: "actor-2",
    note: "I do a lot of movement and clown work; close, physical performance is my strength.",
  },
  {
    projectTitle: "Cut to Black",
    applicantKey: "writer-1",
    note: "Writing in the edit is a fun constraint. Send me the footage and I'll pitch a shape.",
  },
  {
    projectTitle: "Resonance",
    applicantKey: "producer-1",
    note: "I can lock a venue and a small crew fast. Done a couple of live-score events before.",
  },
  {
    projectTitle: "Two-Hander",
    applicantKey: "actor-2",
    note: "A true two-hander is rare — I'd love to build it with you from the ground up.",
  },
  {
    projectTitle: "Open Mic",
    applicantKey: "writer-1",
    note: "I can turn a loose outline into tight 8 pages quickly. Comedy timing is my thing.",
  },
  {
    projectTitle: "Midnight Diner",
    applicantKey: "actor-1",
    note: "Putting myself forward for one of the diner roles — night shoots are no problem.",
  },
  {
    projectTitle: "Midnight Diner",
    applicantKey: "cinematographer-1",
    note: "Available to DP or operate. I have a small lighting kit that suits a diner interior.",
  },
  {
    projectTitle: "Neon Saints",
    applicantKey: "composer-1",
    note: "Not the posted role, but if you need a score for the cut I'd love to be considered.",
  },
];

type EventSpec = {
  title: string;
  ownerKey: string; // must be an approved pro
  event_type: "screening" | "q_and_a" | "panel" | "festival" | "mixer";
  venue: string;
  description: string;
  daysFromNow: number; // starts_at, relative to seed time
};

const EVENTS: EventSpec[] = [
  {
    title: "Indie Shorts Night + Q&A",
    ownerKey: "producer-1",
    event_type: "screening",
    venue: "Echo Park Film Center, Los Angeles",
    description:
      "Six pre-union shorts back to back, with a director Q&A after the final reel.",
    daysFromNow: 9,
  },
  {
    title: "Making a Debut Feature on Weekends",
    ownerKey: "director-1",
    event_type: "panel",
    venue: "Virtual",
    description:
      "A working director walks through scheduling, budgeting, and surviving a multi-month weekend shoot.",
    daysFromNow: 16,
  },
  {
    title: "Cinematographers' Mixer",
    ownerKey: "cinematographer-1",
    event_type: "mixer",
    venue: "The Lot, Brooklyn, NY",
    description:
      "Drinks and reel-sharing for camera department folks looking for their next collaborators.",
    daysFromNow: 23,
  },
  {
    title: "Festival Strategy for First-Timers",
    ownerKey: "producer-1",
    event_type: "q_and_a",
    venue: "Virtual",
    description:
      "Which festivals to target, how to budget submissions, and what a programmer actually looks for.",
    daysFromNow: 30,
  },
];

type ArticleSpec = {
  title: string;
  ownerKey: string; // must be an approved pro
  category: "interview" | "craft" | "scene_report" | "news";
  excerpt: string;
  body: string;
};

const ARTICLES: ArticleSpec[] = [
  {
    title: "How a microbudget short found its festival run",
    ownerKey: "director-1",
    category: "interview",
    excerpt:
      "A first-time director on stretching $4k across three shooting days.",
    body:
      "When the budget topped out at four thousand dollars, every decision became a question of scope. There was no second unit, no rental truck, no catering — just a borrowed apartment, a crew of five, and a schedule built around when everyone could get a day off work.\n\n\"The constraint was the whole movie,\" the director told us. \"I wrote toward the locations I already had access to. The story is small because the production had to be small, and I stopped pretending that was a weakness.\"\n\nThree shooting days became three festival selections. The film never played a multiplex, but it traveled — a regional shorts block, a genre weekender, and a hometown premiere that sold out on word of mouth.\n\nThe takeaway for anyone starting out: finish the thing. A flawed short that exists will teach you more, and open more doors, than a perfect one that never leaves the page.",
  },
  {
    title: "Five casting directors on what a self-tape needs",
    ownerKey: "actor-1",
    category: "craft",
    excerpt:
      "The small choices that get you to the next round — and the ones that don't.",
    body:
      "Casting directors watch hundreds of self-tapes a week, and the ones that work tend to get the same small things right. We asked five of them what makes a tape land.\n\nFirst: the first five seconds. Slate quickly and get into it. A long, apologetic preamble reads as nerves before the scene has even started.\n\nSecond: sound over picture. A clean, quiet audio track beats a beautifully lit frame with a humming refrigerator behind it. Phones are fine; echoey rooms are not.\n\nThird: eyeline and framing. Keep your reader just off-camera, hold a steady medium shot, and let the work happen in your face. Resist the urge to direct yourself with fancy moves.\n\nNone of this is about production value. It's about removing every reason for someone to stop watching before your choices have a chance to register.",
  },
  {
    title: "Inside an underground short-film circuit",
    ownerKey: "writer-1",
    category: "scene_report",
    excerpt:
      "Where rising filmmakers screen the work that won't play the multiplex.",
    body:
      "The screening starts forty minutes late because the projector won't talk to the laptop. Nobody in the room of sixty seems to mind. This is the microcinema circuit, and patience is part of the deal.\n\nThese nights happen in back rooms, co-ops, and the occasional actual theater rented for a Tuesday. The programming is fearless precisely because there's no box office to answer to — experimental, unfinished, gloriously strange.\n\nWhat holds it together is an economy of favors. Someone's friend runs the door, a filmmaker from last month mans the projector, and everyone shows up for everyone else because next month it's their turn on the screen.\n\nIt isn't a launchpad in any official sense. But it's where a lot of first films find their first audience — and where a lot of collaborators find each other.",
  },
  {
    title: "Editors are quietly rewriting your favorite shorts",
    ownerKey: "editor-1",
    category: "news",
    excerpt: "How the cut, not the script, is shaping a wave of indie shorts.",
    body:
      "There's a quiet shift happening in how small films get made: more and more of the story is being found in the edit rather than locked on the page.\n\nPart of it is practical. When you're shooting on weekends with whatever you can get, coverage is uneven and plans change. Editors have become the people who turn what was actually captured into what the film is about.\n\n\"I get footage and a vibe, not a locked script,\" one editor told us. \"My first cut is really the rewrite. We figure out the movie by watching it.\"\n\nPurists worry this loses something — the discipline of writing a tight script first. But for a generation of filmmakers working without a safety net, 'writing in post' isn't a shortcut. It's the craft.",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────--

const emailFor = (key: string) => `seed-${key}@${SEED_DOMAIN}`;

/** Map of seed email → existing auth user id, paging through all auth users. */
async function fetchSeedAuthUsers(): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  const perPage = 1000;
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    for (const user of data.users) {
      if (user.email?.endsWith(`@${SEED_DOMAIN}`)) {
        found.set(user.email, user.id);
      }
    }
    if (data.users.length < perPage) break;
  }
  return found;
}

/** Ensure an auth user exists for `email`; returns its id. Re-runnable. */
async function ensureAuthUser(
  email: string,
  existing: Map<string, string>
): Promise<string> {
  const id = existing.get(email);
  if (id) {
    // Reset to the known shared password so logins are predictable on re-run.
    const { error } = await admin.auth.admin.updateUserById(id, {
      password: SHARED_PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    return id;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: SHARED_PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user.id;
}

function assertExpr(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

// ── Main ──────────────────────────────────────────────────────────────────--

async function main() {
  // Validate the data set up front (cheap, catches typos before any writes).
  const approvedKeys = new Set(
    PROS.filter((p) => p.status === "approved").map((p) => p.key)
  );
  for (const proj of PROJECTS) {
    assertExpr(
      approvedKeys.has(proj.ownerKey),
      `Project "${proj.title}" owned by non-approved key "${proj.ownerKey}"`
    );
  }
  const projectByTitle = new Map(PROJECTS.map((p) => [p.title, p]));
  const seenPairs = new Set<string>();
  for (const app of APPLICATIONS) {
    const proj = projectByTitle.get(app.projectTitle);
    assertExpr(!!proj, `Application references unknown project "${app.projectTitle}"`);
    assertExpr(
      approvedKeys.has(app.applicantKey),
      `Application by non-approved key "${app.applicantKey}"`
    );
    assertExpr(
      proj!.ownerKey !== app.applicantKey,
      `Self-application: "${app.applicantKey}" on their own "${app.projectTitle}"`
    );
    const pair = `${app.projectTitle}::${app.applicantKey}`;
    assertExpr(!seenPairs.has(pair), `Duplicate application: ${pair}`);
    seenPairs.add(pair);
  }
  for (const ev of EVENTS) {
    assertExpr(
      approvedKeys.has(ev.ownerKey),
      `Event "${ev.title}" owned by non-approved key "${ev.ownerKey}"`
    );
  }
  for (const art of ARTICLES) {
    assertExpr(
      approvedKeys.has(art.ownerKey),
      `Article "${art.title}" owned by non-approved key "${art.ownerKey}"`
    );
  }

  console.log("Seeding marketplace…\n");

  // 1. Auth users + profiles.
  const existing = await fetchSeedAuthUsers();
  const idByKey = new Map<string, string>();

  for (const pro of PROS) {
    const email = emailFor(pro.key);
    const id = await ensureAuthUser(email, existing);
    idByKey.set(pro.key, id);

    const { error } = await admin.from("profiles").upsert(
      {
        id,
        email,
        account_type: "professional",
        application_status: pro.status,
        role: pro.discipline,
        display_name: pro.display_name,
        headline: pro.headline,
        bio: pro.bio,
      },
      { onConflict: "id" }
    );
    if (error) throw error;
  }
  console.log(
    `  profiles: ${PROS.length} professionals ` +
      `(${approvedKeys.size} approved, ${PROS.length - approvedKeys.size} pending)`
  );

  // 2. Projects. Delete seed-owned projects first (cascades their
  //    applications), then re-insert — keeps re-runs duplicate-free.
  const seedIds = [...idByKey.values()];
  const { error: delErr } = await admin
    .from("projects")
    .delete()
    .in("created_by", seedIds);
  if (delErr) throw delErr;

  const projectRows = PROJECTS.map((p) => ({
    created_by: idByKey.get(p.ownerKey)!,
    title: p.title,
    discipline: p.discipline,
    description: p.description,
    location: p.location,
    compensation: p.compensation,
    status: p.status,
  }));
  const { data: insertedProjects, error: projErr } = await admin
    .from("projects")
    .insert(projectRows)
    .select("id, title");
  if (projErr) throw projErr;

  const projectIdByTitle = new Map(
    (insertedProjects ?? []).map((p: { id: string; title: string }) => [
      p.title,
      p.id,
    ])
  );
  console.log(`  projects: ${insertedProjects?.length ?? 0} created`);

  // 3. Applications. Prior seed applications were already removed by the
  //    project cascade above, so a plain insert stays duplicate-free.
  const applicationRows = APPLICATIONS.map((a) => ({
    project_id: projectIdByTitle.get(a.projectTitle)!,
    applicant_id: idByKey.get(a.applicantKey)!,
    note: a.note,
  }));
  const { data: insertedApps, error: appErr } = await admin
    .from("applications")
    .insert(applicationRows)
    .select("id");
  if (appErr) throw appErr;
  console.log(`  applications: ${insertedApps?.length ?? 0} created`);

  // 4. Events. Delete seed-owned events first, then re-insert (published, so
  //    the Explore screens show real cards). Same delete-then-insert shape as
  //    projects keeps re-runs duplicate-free.
  const { error: delEvErr } = await admin
    .from("events")
    .delete()
    .in("created_by", seedIds);
  if (delEvErr) throw delEvErr;

  const eventRows = EVENTS.map((e) => ({
    created_by: idByKey.get(e.ownerKey)!,
    title: e.title,
    description: e.description,
    venue: e.venue,
    event_type: e.event_type,
    starts_at: new Date(Date.now() + e.daysFromNow * 86_400_000).toISOString(),
    status: "published",
  }));
  const { data: insertedEvents, error: evErr } = await admin
    .from("events")
    .insert(eventRows)
    .select("id");
  if (evErr) throw evErr;
  console.log(`  events: ${insertedEvents?.length ?? 0} created`);

  // 5. Articles. Same delete-then-insert, published.
  const { error: delArtErr } = await admin
    .from("articles")
    .delete()
    .in("created_by", seedIds);
  if (delArtErr) throw delArtErr;

  const articleRows = ARTICLES.map((a) => ({
    created_by: idByKey.get(a.ownerKey)!,
    title: a.title,
    category: a.category,
    excerpt: a.excerpt,
    body: a.body,
    status: "published",
  }));
  const { data: insertedArticles, error: artErr } = await admin
    .from("articles")
    .insert(articleRows)
    .select("id");
  if (artErr) throw artErr;
  console.log(`  articles: ${insertedArticles?.length ?? 0} created`);

  console.log("\nDone. ✅");
  console.log(`\n  Login email pattern:  seed-<role>-<n>@${SEED_DOMAIN}`);
  console.log(`  Shared password:      ${SHARED_PASSWORD}`);
  console.log(`  Re-run any time:      npm run seed\n`);
}

main().catch((err) => {
  console.error("\nSeed failed:", err?.message ?? err);
  process.exit(1);
});
