# Decisions

A running log of significant decisions. Newest entries go at the top.

## Template

```markdown
## YYYY-MM-DD — Short title

**Decision:** What was decided.

**Reasoning:** Why this was the right call.

**Alternatives considered:** What else was weighed and why it was set aside.
```

---

## 2026-08-11 — The unread rule lives in `getUnreadChatCount()`, not `getInbox()`

**Decision:** The Messages nav badge gets its number from a dedicated `getUnreadChatCount(supabase, userId)` in `app/messages/data.ts` — two narrow queries (my accepted participant rows, then `conversation_id, created_at` of other-party messages in them) — rather than from `getInbox()`. `getUnreadCount()` in `app/messages/actions.ts` now delegates to it, so there is one unread rule and not two, and `getNavCounts()` calls it alongside the pending-connections count under a single `Promise.all`. Both functions define UNREAD identically: **accepted conversations only** (pending message requests belong to the Requests tab, not this badge) and **excluding the viewer's own messages** (`getInbox` filters in JS, `getUnreadChatCount` as `.neq("sender_id", userId)` — equivalent, and it fetches less). **They must be changed together.** The now-dead `app/messages/messages-nav-button.tsx` was deleted; `ProShell`'s `CountBadge` replaces it, and every badged nav link now carries the count in its accessible name (`"Messages, 1 unread"`, `"Network, 2 pending"`).

**Reasoning:** `getInbox` runs four queries and pulls every message **body** in every one of the viewer's conversations to build list summaries. That is the right shape for `/messages`, which renders those summaries — and the wrong shape for the app shell, which renders on *every* page and needs one integer. Going through `getInbox` for the badge would put whole-inbox message fetches on every navigation in the app. The two counts in `getNavCounts` are independent, so sequencing them would add a round trip to each navigation for nothing. The `aria-label` is a real fix, not test scaffolding: the badge is a bare digit, so a screen-reader user previously heard "Messages" with no indication of the count — which is what `MessagesNavButton` used to convey and Phase 3a dropped.

**Alternatives considered:** Calling `getInbox().unreadChats` from `getNavCounts` — rejected on cost, per above. Leaving `messages` hardcoded `0` and reviving `MessagesNavButton` as a client-side fetch — rejected: two Messages entry points in one shell, and a per-navigation server-action round trip to duplicate a badge the nav already has. A test hook (`data-testid`) on `CountBadge` instead of the `aria-label` — rejected: the accessibility gap is real, and an `aria-label` fixes it while giving the test a hook for free. A single count query with a SQL-side join — rejected as an RPC/migration for a count that two narrow selects already produce, and this phase adds no schema.

## 2026-08-07 — Connection requests live on /network; the Network badge is the discovery mechanism

**Decision:** `/network` is the canonical home for incoming connection requests — the full list, uncapped, in a `CallboardCard` above the "Discover creators" grid. The feed's right-rail `ConnectionRequestsCard` stays as-is (capped at 5) and is not duplicated into the feed's centre column. `getNavCounts()` becomes a real server read, but for **`network` only** — a `head: true` exact count of pending rows where the viewer is the addressee; `projects`, `classes` and `messages` still return `0`. It is awaited in exactly one place, a new `ProShellServer` server component that wraps the client `ProShell` and passes `counts` as a required prop; the nine layouts and pages that rendered `ProShell` now render `ProShellServer`. `ConnectionRequestActions` moved from `app/dashboard/` to `components/` now that it has two consumers; the server actions stayed in `app/dashboard/connection-actions`.

**Reasoning:** The right rail is `max-wide:hidden`, so below 1180px an incoming request was invisible unless the requester happened to post — and even then the only affordance was an Accept pill with no way to decline. A route that exists at every width fixes reachability; the nav badge fixes discovery, since a number on the Network tab is visible on both the desktop nav and the mobile tab bar. `counts` is a **required** prop precisely so `tsc` fails on any layout that wasn't swapped — the type checker enumerates the call sites instead of a person doing it. Fetching in `ProShellServer` rather than per-layout means one query to keep in sync instead of nine. `network` alone is wired because counts for the other three haven't been specified or verified, and shipping three unverified badges is worse than shipping none. The requests query needs no RPC: "Parties read own connections" already permits it, as the viewer is a party to every row.

**Alternatives considered:** A dedicated `/requests` route — rejected as a route whose content is one list that belongs beside the people-discovery surface anyway. Rendering the requests card in the feed's centre column below 1180px — rejected: two copies of one list on one page is a maintenance liability, and the badge already solves discovery. Calling `getNavCounts()` in each of the nine layouts — rejected for the nine-way sync problem. Making `counts` optional with a zeroed default — rejected: it would let a missed layout compile and silently render a dead badge. Restyling the rest of `/network` to Callboard in this phase — deferred; the new section reads ahead of the page around it, which is the right direction of travel.

## 2026-08-07 — Wiring the feed's social actions: skill vocabulary, inline picker, one delete action

**Decision:** The endorsement skill vocabulary is `profiles.role` (the primary discipline) plus `profiles.skills` (secondary), deduped case-insensitively at the picker with the first occurrence winning, and every string is sent to the database **raw** — no trim, no lowercase, no slugification — with only the *label* prettified (`disciplineLabel()` for known discipline values, `titleCase()` otherwise). A post whose author lists nothing renders no Endorse action at all. The Endorse picker is an **inline disclosure** inside the post card, not a popover. `removeConnection(otherId)` is a single server action covering withdraw, decline and disconnect. Share stays non-interactive.

**Reasoning:** `profile_lists_skill()` validates the skill with `lower(role) = lower(skill) OR skill = any(skills)` — the array arm is case-sensitive, and `endorsement_count()` compares exactly — so normalising in the client would either fail the INSERT policy outright or silently split one skill's tally into two buckets. Deduping case-insensitively is still necessary because `role` and `skills` overlap in practice ("Editor" vs "editor"), and sending both would offer the same endorsement twice. The picker is inline because this repo has no popover / dropdown-menu / dialog component, and adding one via the shadcn CLI would drag in the `bg-accent` → `bg-surface-sunken` remap chore recorded below — a comment-well-style disclosure was already a proven pattern in the same card. One delete action because the DELETE policy ("Parties delete own connections") permits all three cases identically and the unique pair index guarantees at most one matching row, so three actions would be three names for one query; the PostgREST `.or()` pair filter was verified against the live database in both directions (requester side and addressee side) before shipping. Share has nothing to do: there is no per-post permalink route.

**Alternatives considered:** Lowercasing or slugifying skills for a tidy vocabulary — rejected as a silent data-integrity bug against the policy and the count helper. Storing an endorsement vocabulary of its own — rejected; Phase 2 deliberately put the vocabulary on the profile. Adding a popover component for the picker — rejected for the remap cost and a new dependency this phase forbade. Separate `withdrawConnection` / `declineConnection` / `disconnect` actions — rejected as three wrappers over one identical delete. Splitting the picker's trigger and panel into two independent components — impossible without shared state, so the two halves share one React context while the trigger sits in the action bar `CommentThread` owns.

## 2026-08-05 — Connections: a bidirectional pro-to-pro layer alongside follows

**Decision:** Add `public.connections` (with `activity_reactions` and `endorsements`) as the Callboard design's bidirectional relationship, coexisting with `public.follows` rather than replacing it. `follows` keeps every job it does today — the feed, the messaging free-pass rule, the Requests tab — and is untouched. A connection row is directional (`requester_id` / `addressee_id`, so the UI can render Pending-outgoing vs Pending-incoming) but the relationship is symmetric once accepted: either side counts as connected, either side may disconnect, and a reciprocal duplicate (A→B while B→A exists) is blocked by a unique index over the canonically ordered pair. Connect is pro-to-pro only — both parties must be approved professionals — while Fans keep using follows. Endorsements are readable by any member; connections are readable only by their two parties. "Circle" currently means exactly your accepted connections — the `circle_enrolled_count` / `circle_applied_count` helpers count those; named circle groups (the "Your circles" card) are a separate future concept, and if they ship these helpers would need renaming. Every cross-user read (connection status, connection/mutual counts, reaction and endorsement counts, circle counts, and the approved-pro / listed-skill checks on the *other* party) goes through a security-definer function, never an inline subquery in a policy.

**Reasoning:** The feed design carries `relationship = none | following | connected` on every author, so both models must exist side by side; replacing follows would break the messaging free-pass rule and the Fan app's follow-only feed. Directional-but-symmetric keeps the Pending states renderable from one row without duplicating edges. Endorsements are member-visible because they are public social proof ("vouched by <name>") — their value is exactly that others can see them — while a connection graph is private business between two people, exposed only as scalar counts that never leak who. Security-definer helpers are non-negotiable: an inline `count(*)`/`exists()` inside a policy runs under the caller's own SELECT policy and silently returns the wrong answer (the bug that let class capacity oversubscribe), and the same failure hits identity checks on the other party and the mutual-connection undercount.

**Alternatives considered:** Replacing follows with connections — rejected; follows carries live features and Fans have no pro approval to connect with. A single-row undirected edge (store only the sorted pair) — rejected because Pending-incoming vs Pending-outgoing requires knowing who asked. Two mirrored rows per connection — rejected as a consistency liability (accept/delete must touch both atomically). Making connections member-visible like endorsements — rejected; the counts the UI needs are served by helpers without exposing anyone's graph. Naming the circle helpers after a future named-groups concept — rejected; name them for what they count today and rename if groups ever ship.

## 2026-06-25 — Option C — feed-first, two account-type apps (Pro & Fan)

**Decision:** Restructure Action as a feed-first platform with two tailored, account-type-specific experiences on one codebase. **Pro** (application-gated professionals) keeps the full toolkit across five surfaces — Feed, Explore, Network, Messages, Profile. **Fan** (open access, no application) becomes a first-class account type with its own consumer app across five surfaces — Feed, Discover, Events, Read, Profile — for following and supporting emerging filmmakers, with no projects, classes, casting, or applications and a strictly follow-only feed. Both account types get a feed. Standardize product/UI terminology on **Pro** and **Fan** while leaving database `account_type` values unchanged: Pro = "Creator" (older docs) = `'professional'`, Fan = `'consumer'`. Ship this as mobile-first responsive web — the five-tab bottom bar is a mobile layout treatment, not a native app; native mobile stays Phase 3. Recorded as a future step (not implemented here): open the `follows` insert policy, currently approved-Pros-only, to consumers when the Fan feed ships, since that feed depends on Fans being able to follow people.

**Reasoning:** This reconciles a contradiction between the older docs and the chosen design mockups. VISION.md framed fans as "a discovery and audience layer, not a marketplace participant," while the mockups give the Fan experience its own app and feed. Two tailored surface sets keep the Pro toolkit signal-rich while opening a low-friction growth and support channel through fans — without turning fans into marketplace participants. Standardizing on Pro/Fan stops the docs carrying three overlapping terms (Pro/Creator/professional). Mobile-first responsive web delivers the layout the mockups assume without the cost and review overhead of native apps this early.

**Alternatives considered:** Keeping fans as a passive audience layer with no app of their own — rejected as contradicting the mockups and underusing fans as a visibility channel for emerging creators. A single unified app and shared feed for both account types — rejected because Pro and Fan needs diverge sharply (marketplace, network, and applications are meaningless to fans; a follow-only feed is the wrong default for Pros). Building native mobile now to deliver the five-tab layout — rejected as premature; responsive web delivers the same layout, and native stays a Phase 3 investment.

## 2026-05-28 — Fresh product repo, separate from the business plan

**Decision:** Start the product in a new `action-tabib` repository, kept separate from the deployment that hosts the business plan, and build on modern-but-stable tools rather than bleeding-edge ones.

**Reasoning:** The business plan is a static marketing artifact with a different lifecycle than the product; keeping them apart avoids coupling deploys and dependencies. A clean repo lets the product start with the stack we actually want. Choosing established, well-supported tools (see [STACK.md](STACK.md)) keeps velocity high and risk low for an early-stage build.

**Alternatives considered:** Building the product inside the existing business-plan repo — rejected because it would entangle two unrelated codebases and deployments. Reaching for the newest experimental tooling — rejected as unnecessary risk this early.

## Design tokens: --accent is Callboard navy, not shadcn's highlight

--accent is Callboard's brand navy (#14213d light / #8aa6d8 dark). shadcn
components use bg-accent / text-accent-foreground for subtle hover and
highlight states, which under this palette renders solid navy.

When adding any shadcn component via the CLI, remap its bg-accent /
text-accent-foreground pattern to bg-surface-sunken / text-text-primary
before committing. Affected: dropdown-menu, select, command,
navigation-menu, sidebar, context-menu, menubar.

components/ui/combobox.tsx has already been remapped.
