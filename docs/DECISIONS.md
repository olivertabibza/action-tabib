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

## 2026-05-28 — Fresh product repo, separate from the business plan

**Decision:** Start the product in a new `action-tabib` repository, kept separate from the deployment that hosts the business plan, and build on modern-but-stable tools rather than bleeding-edge ones.

**Reasoning:** The business plan is a static marketing artifact with a different lifecycle than the product; keeping them apart avoids coupling deploys and dependencies. A clean repo lets the product start with the stack we actually want. Choosing established, well-supported tools (see [STACK.md](STACK.md)) keeps velocity high and risk low for an early-stage build.

**Alternatives considered:** Building the product inside the existing business-plan repo — rejected because it would entangle two unrelated codebases and deployments. Reaching for the newest experimental tooling — rejected as unnecessary risk this early.
