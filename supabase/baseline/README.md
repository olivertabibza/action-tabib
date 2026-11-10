# Baseline: a snapshot of production's schema

These files are a snapshot of the production Supabase project's schema taken on
**2026-10-29**, for building new environments (today: the `action-test` project
that `npm test`, `npm run test:e2e`, CI and `npm run seed` use). They contain
schema only: no rows, users, emails, keys or passwords.

| File | What it holds | How it was made |
| --- | --- | --- |
| `public-schema.sql` | Every table, view, function, trigger, policy and grant (including column grants) in `public` | `pg_dump "$PROD_DB_URL" --schema-only --schema=public --no-owner` |
| `platform.sql` | What that dump misses: extensions, storage buckets, every policy on `storage.objects` / `storage.buckets`, and auth-schema customizations (there are none) | Hand-assembled from read-only SELECTs against production |

## Applying them to a new, empty Supabase project

```bash
set -a; source .env.test.local; set +a
psql "$TEST_DB_URL" -v ON_ERROR_STOP=1 --single-transaction \
  -f supabase/baseline/public-schema.sql \
  -f supabase/baseline/platform.sql
```

`public-schema.sql` goes first because the storage policies in `platform.sql`
call `public.is_admin()` / `public.is_approved_pro()` and read
`public.profiles`. The public schema doesn't depend on any extension (it uses
the built-in `gen_random_uuid()`), and a new Supabase project has them all
anyway. `--single-transaction` means a failure leaves the project untouched.

## These are not the source of truth

The feature files in `supabase/*.sql` remain the source of truth for changes.
Never edit the baseline to change the schema: write or edit a feature file, run
it on the test project, pass `npm test` there, then run it on production (see
`docs/DECISIONS.md`, 2026-10-29). The baseline only needs refreshing when you
build another environment and want it to match production as it is then.
