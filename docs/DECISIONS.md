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
