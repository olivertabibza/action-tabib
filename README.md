# Action

**Action** is a feed-first, two-sided web platform for the film industry. It
serves pre-union creatives — actors, writers, directors, producers,
cinematographers, editors, and composers — with auditions, education,
networking, and events, and gives film fans a window into emerging filmmakers
through news, events, and a follow-based feed.

Every account is one of two types, and each type gets its own app, its own feed,
and its own navigation shell:

- **Pro** — application-gated industry professionals (`account_type = 'professional'`).
- **Fan** — open-access film enthusiasts (`account_type = 'consumer'`).

> Terminology: product/UI copy says **Pro** and **Fan**; the database uses
> `account_type` values `'professional'` and `'consumer'`. Older docs say
> "Creator" for Pro. See [docs/VISION.md](docs/VISION.md) and
> [docs/DECISIONS.md](docs/DECISIONS.md).

- **Deployed app:** _coming soon_
- **Business plan:** https://action-web-kappa.vercel.app

---

## Tech stack

| Area | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router) |
| UI runtime | React 19 |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui primitives (built on Base UI / `radix-ui`), `lucide-react` icons |
| Forms | `react-hook-form` with per-feature `schema.ts` validation shared by client and server |
| Backend | Supabase — Postgres, Auth, and Storage, accessed via `@supabase/ssr` |
| Hosting | Vercel |

The app talks to Supabase entirely through the **anon key** with Row Level
Security enforcing access — no application code uses the service-role/secret
key. See [docs/STACK.md](docs/STACK.md) for the full rationale and the planned
additions (Stripe, Resend, video pipeline, analytics).

> **This is not the Next.js you may know.** Next.js 16 renames and reshapes a
> number of APIs (e.g. Middleware is now the **Proxy** in `proxy.ts`, `cookies()`
> is async). Read the bundled guides in `node_modules/next/dist/docs/` before
> writing framework code. See [AGENTS.md](AGENTS.md).

---

## Getting started

### Prerequisites

- Node.js 20+
- A Supabase project (Postgres + Auth + Storage)

### 1. Install

```bash
npm install
```

### 2. Configure environment

Create `.env.local` in the repo root:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>

# Only needed to run the seed script (server-only, bypasses RLS):
SUPABASE_SECRET_KEY=sb_secret_...
```

### 3. Apply the database schema

The SQL under [`supabase/`](supabase/) is run by hand in the Supabase SQL editor.
Every file is idempotent (safe to re-run). Apply them, then follow the one-time
admin bootstrap note at the top of `supabase/admin.sql`. See
[Database](#database) below for what each file does.

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run seed` | Seed demo pros, projects, and applications (needs `SUPABASE_SECRET_KEY`) |

---

## How the app is structured

### Authentication & routing flow

1. A visitor signs up at `/signup` (choosing Pro or Fan) or logs in at `/login`.
2. Supabase emails a confirmation link; the user lands on
   `/auth/callback`, which exchanges the `?code` for a session and forwards to
   `/onboarding`.
3. `/onboarding` records the chosen `account_type` and sends the user into their
   app.
4. The **Proxy** ([`proxy.ts`](proxy.ts)) — Next.js 16's renamed Middleware —
   runs on every matched request. It refreshes the Supabase session cookies (so
   server components always see fresh auth), redirects logged-out users away
   from protected routes (`/fan`, `/profile`, `/projects`, `/admin`), and
   redirects logged-in users away from `/login` and `/signup` into their app
   (`/fan` for consumers, `/dashboard` for everyone else).
5. The public homepage `/` is login-state aware: marketing for logged-out
   visitors, an automatic redirect to the right app for logged-in users. The old
   `/home` route is retired and just forwards to `/`.

Per-section **layouts** add a second access gate close to the data — e.g.
`app/projects/layout.tsx` admits only approved pros, and the Pro feature
layouts (`app/messages`, `app/explore`, `app/classes`) redirect logged-out →
`/login` and non-approved-pro → `/home`.

### The two app shells

Both shells are mobile-first responsive web: a left sidebar on desktop, a fixed
bottom tab bar on mobile. They share a single `navItems` source of truth so the
two layouts can't drift.

**Pro** ([`components/ProShell.tsx`](components/ProShell.tsx)) — tabs:

| Tab | Route |
| --- | --- |
| Feed | `/dashboard` |
| Projects | `/projects` |
| Classes | `/classes` |
| Explore | `/explore` |
| Profile | `/profile` |

Messages is a fixed top-right icon button (not a tab), present on every Pro
screen. Network lives on the Profile page.

**Fan** ([`components/FanShell.tsx`](components/FanShell.tsx)) — tabs:

| Tab | Route |
| --- | --- |
| Feed | `/fan` |
| Explore | `/fan/explore` |
| Events | `/fan/events` |
| Profile | `/fan/profile` |

`/fan/discover` and `/fan/read` are kept as redirects to `/fan/explore` so old
links don't break.

### Feature areas

- **Profiles** (`/profile`) — editable creative identity (display name, role,
  headline, bio) plus portfolio files; `/profile/[id]` is a public read-only
  view of an approved pro.
- **Project marketplace** (`/projects`) — approved pros post roles (`/projects/new`),
  browse/filter open listings, view a project (`/projects/[id]`) and apply, and
  manage their own posts (`/projects/mine`).
- **Social feed** (`/dashboard`) — follow-based activity feed with a compose box
  for status updates.
- **Network** (`/network`) — follow/unfollow other members.
- **Admin** (`/admin`) — review applications and moderate project listings.
- **Stubs** for the next product phase: Pro `Classes` and `Explore`, Fan
  `Events` and `Explore` content, and Messages.

### Directory layout

```
app/                    App Router routes
  page.tsx              Login-aware marketing homepage
  layout.tsx            Root layout (loads session, renders top Nav)
  login, signup         Auth pages
  auth/callback         OAuth/email code exchange (route handler)
  onboarding            Pick account type after sign-up
  dashboard             Pro feed (+ layout gate, server actions, compose box)
  projects              Marketplace (list, [id], new, mine; layout gate)
  explore, classes      Pro stubs (gated like messages)
  messages              Pro messages stub
  network               Follow/unfollow
  profile               Own profile (+ [id] public view, form, actions)
  admin                 Application review + project moderation
  fan                   Fan app (feed, explore, events, profile; layout gate)
components/             ProShell, FanShell, Nav, LogoutButton, ui/ (shadcn)
lib/                    supabase/ (server + client), marketplace, portfolio, utils
supabase/               Idempotent SQL: schema, RLS, storage policies
scripts/seed.ts         Demo-data seeder (server-only, secret key)
docs/                   VISION, ROADMAP, STACK, DECISIONS, mockups
proxy.ts                Session refresh + route gating (Next 16 Middleware)
```

---

## Database

Postgres lives in Supabase. Access is governed by **Row Level Security**;
elevated reads/writes come from `security definer` helper functions
(`is_approved_pro()`, `is_admin()`, `has_applied()`, `is_following()`), never
from the secret key. Apply these files in the Supabase SQL editor:

| File | What it sets up |
| --- | --- |
| `add-profile-fields.sql` | `profiles` editable columns (`display_name`, `headline`, `bio`) + self-update policy |
| `fix-profiles-policy.sql` | Explicit self-insert / self-update policies on `profiles` |
| `marketplace.sql` | `projects` and `applications` tables, indexes, and marketplace RLS; `is_approved_pro()` / `has_applied()` helpers |
| `social-feed.sql` | `follows` and `activity_events` tables + RLS; `is_following()` helper |
| `public-profiles.sql` | `public_profiles` view and storage policy so anon visitors can read approved pros |
| `admin.sql` | `profiles.is_admin` flag, `is_admin()` helper, admin RLS, and the one-time admin bootstrap note |

### Core tables

- **`profiles`** — one row per auth user (`id` == `auth.users.id`). Holds
  `account_type` (`professional` / `consumer`), `application_status`
  (`pending` / `approved`), `is_admin`, and the editable profile fields.
- **`projects`** — marketplace listings owned by a pro, with `discipline`,
  `compensation`, and `status` (`open` / `closed`).
- **`applications`** — a pro's application to a project (unique per
  project+applicant).
- **`follows`** — directed follow edges (`follower_id` → `following_id`); a
  one-way follow, not a mutual connection.
- **`activity_events`** — append-only feed log; today only `status_update` and
  `started_following` events are writable.
- **`public_profiles`** (view) — public-safe columns for approved pros, readable
  by anon.

### Storage

Portfolio files live in a **private** `portfolios` bucket under `<user_id>/…`.
Pages mint short-lived signed URLs with the anon key; storage RLS lets owners,
admins, and (for approved pros only) the public read the right objects.

---

## Documentation

- [docs/VISION.md](docs/VISION.md) — product vision, the two account types, feature areas, competitive positioning
- [docs/ROADMAP.md](docs/ROADMAP.md) — phased roadmap and status
- [docs/STACK.md](docs/STACK.md) — tech choices and reasoning (current + planned)
- [docs/DECISIONS.md](docs/DECISIONS.md) — log of significant decisions
- [AGENTS.md](AGENTS.md) / [CLAUDE.md](CLAUDE.md) — working conventions for this repo
</content>
