@AGENTS.md

## How to work in this repo

**Think before coding.** State your assumptions. If multiple reasonable interpretations exist, surface them instead of silently picking one. If a simpler approach exists, say so. If something is unclear, stop and ask rather than guess.

**Simplicity first.** Write the minimum code that solves the task. No speculative features, no abstractions for single-use code, no configurability that wasn't requested. If you've written 200 lines and it could be 50, rewrite it.

**Surgical changes.** Touch only what the task requires. Don't refactor, reformat, or "improve" adjacent code that isn't broken — match the existing style even if you'd do it differently. Remove only the imports or variables your own changes made unused; flag unrelated dead code instead of deleting it.

**Code quality.** Prefer explicit over clever. Flag and avoid repetition rather than copy-pasting. Aim for "engineered enough" — neither fragile nor over-abstracted. Handle the edge cases that realistically matter.

**Verify before declaring done.** For each task, lay out a short plan with a check for each step, and confirm the build runs and the feature does what was asked before telling me it's finished. Test the critical paths (auth, posting a project, applying); full test suites can wait until closer to launch.

**Subagents (only if you spawn them).** Set the model explicitly and use the cheapest that fits — a fast model for file lookups and searches, a mid model for implementation, the top model only for architecture or planning.
