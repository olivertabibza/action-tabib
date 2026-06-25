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

## 2026-06-25 — Option C — feed-first, two account-type apps (Pro & Fan)

**Decision:** Restructure Action as a feed-first platform with two tailored, account-type-specific experiences on one codebase. **Pro** (application-gated professionals) keeps the full toolkit across five surfaces — Feed, Explore, Network, Messages, Profile. **Fan** (open access, no application) becomes a first-class account type with its own consumer app across five surfaces — Feed, Discover, Events, Read, Profile — for following and supporting emerging filmmakers, with no projects, classes, casting, or applications and a strictly follow-only feed. Both account types get a feed. Standardize product/UI terminology on **Pro** and **Fan** while leaving database `account_type` values unchanged: Pro = "Creator" (older docs) = `'professional'`, Fan = `'consumer'`. Ship this as mobile-first responsive web — the five-tab bottom bar is a mobile layout treatment, not a native app; native mobile stays Phase 3. Recorded as a future step (not implemented here): open the `follows` insert policy, currently approved-Pros-only, to consumers when the Fan feed ships, since that feed depends on Fans being able to follow people.

**Reasoning:** This reconciles a contradiction between the older docs and the chosen design mockups. VISION.md framed fans as "a discovery and audience layer, not a marketplace participant," while the mockups give the Fan experience its own app and feed. Two tailored surface sets keep the Pro toolkit signal-rich while opening a low-friction growth and support channel through fans — without turning fans into marketplace participants. Standardizing on Pro/Fan stops the docs carrying three overlapping terms (Pro/Creator/professional). Mobile-first responsive web delivers the layout the mockups assume without the cost and review overhead of native apps this early.

**Alternatives considered:** Keeping fans as a passive audience layer with no app of their own — rejected as contradicting the mockups and underusing fans as a visibility channel for emerging creators. A single unified app and shared feed for both account types — rejected because Pro and Fan needs diverge sharply (marketplace, network, and applications are meaningless to fans; a follow-only feed is the wrong default for Pros). Building native mobile now to deliver the five-tab layout — rejected as premature; responsive web delivers the same layout, and native stays a Phase 3 investment.

## 2026-05-28 — Fresh product repo, separate from the business plan

**Decision:** Start the product in a new `action-tabib` repository, kept separate from the deployment that hosts the business plan, and build on modern-but-stable tools rather than bleeding-edge ones.

**Reasoning:** The business plan is a static marketing artifact with a different lifecycle than the product; keeping them apart avoids coupling deploys and dependencies. A clean repo lets the product start with the stack we actually want. Choosing established, well-supported tools (see [STACK.md](STACK.md)) keeps velocity high and risk low for an early-stage build.

**Alternatives considered:** Building the product inside the existing business-plan repo — rejected because it would entangle two unrelated codebases and deployments. Reaching for the newest experimental tooling — rejected as unnecessary risk this early.
