import { mkdir } from "node:fs/promises";
import { config } from "dotenv";
import { chromium } from "@playwright/test";

config({ path: ".env.local" });

import { signInAs, getProfileId, seedEmail } from "../helpers/auth";

// The seed pro whose session the E2E suite reuses.
const SMOKE_USER = "actor-1";
// A pro the SMOKE_USER already follows (seed: actor-1 → director-1), so a DM from
// them free-passes straight into an ACCEPTED chat — which is what the unread
// BADGE counts. We use this to make the badge assertion deterministic.
const DM_SENDER = "director-1";

const STATE_DIR = "tests/e2e/.auth";
const STATE_PATH = `${STATE_DIR}/state.json`;

function canonical(x: string, y: string): [string, string] {
  return x < y ? [x, y] : [y, x];
}

/** Fail loudly. Every write below is RLS-constrained, and a fixture that
 *  silently no-ops turns "the badge is broken" into "the test is flaky". */
async function must<T extends { error: { message: string } | null }>(
  query: PromiseLike<T>,
  what: string
): Promise<T> {
  const res = await query;
  if (res.error) {
    throw new Error(`global-setup: ${what} failed — ${res.error.message}`);
  }
  return res;
}

/**
 * Ensure SMOKE_USER has exactly one unread message in an accepted chat, so the
 * ProShell badge deterministically shows. All rows are "[TEST]"-tagged and
 * between seed accounts; the conversation is reused across runs (unique per
 * pair) and last_read_at is reset to null each run to re-arm the unread.
 */
async function ensureUnreadForBadge() {
  const sender = await signInAs(DM_SENDER);
  const recipient = await signInAs(SMOKE_USER);
  const senderId = await getProfileId(DM_SENDER);
  const recipientId = await getProfileId(SMOKE_USER);
  const [user_a, user_b] = canonical(senderId, recipientId);

  let { data: conv } = await sender
    .from("conversations")
    .select("id")
    .eq("user_a", user_a)
    .eq("user_b", user_b)
    .maybeSingle();
  if (!conv) {
    const { data } = await must(
      sender
        .from("conversations")
        .insert({ user_a, user_b })
        .select("id")
        .single(),
      "create the badge conversation"
    );
    conv = data;
  }
  const convId = conv!.id as string;

  // Seed each participant row with THAT user's own client. RLS lets either party
  // INSERT both rows, but an upsert is an ON CONFLICT DO UPDATE and "Update own
  // participant row" only ever permits your own — so a two-row upsert from one
  // client is rejected outright. Both rows are accepted: the badge counts
  // accepted chats only, never pending requests.
  await must(
    sender.from("conversation_participants").upsert(
      { conversation_id: convId, user_id: senderId, accepted: true },
      { onConflict: "conversation_id,user_id" }
    ),
    "seed the sender's participant row"
  );
  await must(
    recipient.from("conversation_participants").upsert(
      { conversation_id: convId, user_id: recipientId, accepted: true },
      { onConflict: "conversation_id,user_id" }
    ),
    "seed the recipient's participant row"
  );

  // One probe message from the sender (guarded so it doesn't accumulate). Both
  // participant rows must exist first — the messages INSERT policy requires the
  // other party's row.
  const { data: existing } = await must(
    sender
      .from("messages")
      .select("id")
      .eq("conversation_id", convId)
      .eq("sender_id", senderId)
      .limit(1),
    "read the probe message"
  );
  if (!existing?.length) {
    await must(
      sender.from("messages").insert({
        conversation_id: convId,
        sender_id: senderId,
        body: "[TEST] unread probe for the badge smoke test",
      }),
      "insert the probe message"
    );
  }

  // Re-arm: mark the recipient's side unread (last_read_at = null).
  await must(
    recipient
      .from("conversation_participants")
      .update({ last_read_at: null })
      .eq("conversation_id", convId)
      .eq("user_id", recipientId),
    "re-arm the unread"
  );
}

async function globalSetup() {
  await ensureUnreadForBadge();

  await mkdir(STATE_DIR, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("http://localhost:3000/login");
  await page.fill("#email", seedEmail(SMOKE_USER));
  await page.fill("#password", process.env.SEED_PASSWORD!);
  await page.getByRole("button", { name: "Log in" }).click();
  // Pros land on the Feed.
  await page.waitForURL("**/dashboard", { timeout: 30_000 });
  await page.context().storageState({ path: STATE_PATH });
  await browser.close();
}

export default globalSetup;
