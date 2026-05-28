# Tech Stack

The guiding principle is modern-but-stable: current frameworks with strong ecosystems, avoiding bleeding-edge tools that add risk without a clear payoff.

## Current

- **Next.js 16 (App Router)** — Full-stack React framework; server components and route handlers cover both UI and API in one codebase.
- **React 19** — Underlying UI library; pairs natively with Next's App Router and server components.
- **TypeScript** — Static typing catches errors early and makes the codebase self-documenting as it grows.
- **Tailwind CSS v4** — Utility-first styling for fast, consistent UI without a separate stylesheet system.
- **shadcn/ui** — Copy-in, fully-owned component primitives instead of a locked-down dependency, so the design is ours to extend.
- **lucide-react** — Clean, consistent icon set that integrates directly with React.
- **Vercel** — First-party Next.js hosting with zero-config deploys and previews.

## Planned

- **Supabase** — Managed Postgres plus auth and file storage in one service, removing a lot of backend setup.
- **Drizzle ORM** — Type-safe, lightweight SQL that keeps full control over queries against Supabase Postgres.
- **React Hook Form + Zod** — Performant forms with a single schema that validates on both client and server.
- **Stripe** — Industry-standard payments for premium memberships and paid features.
- **Resend** — Developer-friendly transactional email for auth, notifications, and digests.
- **Mux or Cloudflare Stream** — Managed video pipeline for audition uploads, so we don't build encoding and delivery ourselves.
- **PostHog** — Product analytics and feature flags to understand usage and roll out features safely.
- **Sentry** — Error and performance monitoring to catch issues in production.
