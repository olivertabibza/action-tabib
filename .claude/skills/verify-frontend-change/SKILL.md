---
name: verify-frontend-change
description: Verify any UI or navigation change end-to-end before declaring it done. Use after editing anything under app/, components/, or any Supabase RLS policy / server action.
---

# Verifying a change before declaring it done

Never report a change as complete based on a successful edit alone. A prompt can
"land" (Claude reports success) while the wiring never actually applied to the
file. The whole point of this skill is to catch that before the user has to.

Run these checks in order. If any check fails, fix it and re-run from the top —
do not report done until every check passes.

## 1. Confirm the edit actually landed in the file

Do NOT trust that an edit applied just because the tool returned success.
Grep the changed files for the specific thing that was supposed to change.

- A count of zero means the edit did NOT apply — investigate before continuing.
  `grep -c "the-string-you-added" path/to/file`  # expect nonzero
- For wiring spread across files:
  `grep -rn "the-pattern" app components | head`

## 2. Type-check and lint

These are deterministic and fast — always run both.

- `npx tsc --noEmit`   # zero errors
- `npm run lint`       # zero errors (warnings are acceptable, flag them)

If either fails, the change is not done. Fix or flag before proceeding.

## 3. Build

- `npm run build`      # must complete without errors

A change that type-checks but breaks the Next.js build (bad server/client
boundary, missing "use client", invalid route segment config) is NOT done.

## 4. Run it and interact with it

- Start the dev server: `npm run dev`
- Open the specific page(s) that were edited.
- Interact with the actual change — click the button, submit the form, follow
  the follow/unfollow action, navigate to the route.
- Check the browser console: zero NEW errors or warnings introduced by the change.

## 5. Navigation-specific checks (any change touching Nav.tsx, a shell, or routing)

The Pro and Fan apps each have their own shell (sidebar + bottom tab bar) and no
global top nav. When a route's shell membership changes, verify BOTH states:

- The bottom tab bar renders on the intended routes and does NOT disappear.
- The marketing top nav does NOT appear on shell routes for approved pros.
- Check the route against `shellRoutes` in components/Nav.tsx — confirm the
  prefix logic (`pathname.startsWith(prefix)`) matches the intended routes.
- Test as an approved pro AND as a fan AND logged out where relevant — the three
  see different shells.

## 6. Supabase / RLS-specific checks (any change touching a policy, view, or server action)

Database changes hit local and production simultaneously (shared instance), so a
broken policy is a production incident. Verify:

- No service-role key was introduced into app code. Public-facing pages must use
  the anon client against RLS-controlled views/tables.
  `grep -rn "service_role\|SERVICE_ROLE" app lib`  # expect zero in app code
- New policies are ADDITIVE and use the established helpers
  (`is_approved_pro()`, `is_admin()`, `is_member()`) consistently.
- Fan write actions use `is_member()`, NOT `is_approved_pro()`.
- Manually exercise the affected path in the running app as the relevant role
  (e.g. a fan performing a follow) and confirm the row lands / the read returns.

## 7. Report honestly

State which checks passed. If a check was skipped (e.g. no dev server access this
run), say so explicitly rather than implying it passed. If anything is a known
gap, name it. Do not claim the feature works if only the edit and type-check ran.
