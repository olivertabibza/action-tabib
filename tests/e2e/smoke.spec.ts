import { test, expect } from "@playwright/test";

/**
 * Layer 2 — thin UI smoke, reusing the logged-in session from global-setup
 * (storageState). Asserts UI truths ONLY: pages render, the badge shows, the
 * tabs exist. RLS is covered by the fast Layer-1 tests — do NOT re-test it here.
 */

const PRO_TABS = [
  "/dashboard",
  "/network",
  "/projects",
  "/classes",
  "/explore",
  "/profile",
];

test("all six Pro tabs load and none says 'Coming soon'", async ({ page }) => {
  for (const path of PRO_TABS) {
    const res = await page.goto(path);
    expect(res?.ok(), `${path} should return ok`).toBeTruthy();
    // The Messages/Classes stubs are gone; no live tab should be a placeholder.
    await expect(
      page.getByText("Coming soon", { exact: false }),
      `${path} should not be a "Coming soon" stub`
    ).toHaveCount(0);
  }
});

test("/classes renders at least one published class card", async ({ page }) => {
  await page.goto("/classes");
  // Seed publishes the "[TEST] Scene Study Fixture" class, so there's ≥1 card
  // linking to a class detail page.
  const classLinks = page.locator('a[href^="/classes/"]:not([href="/classes/new"])');
  await expect(classLinks.first()).toBeVisible();
});

test("/messages renders the Chats and Requests tabs", async ({ page }) => {
  await page.goto("/messages");
  await expect(page.getByRole("link", { name: "Chats" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Requests/ })).toBeVisible();
});

test("the ProShell messages button shows an unread badge", async ({ page }) => {
  await page.goto("/dashboard");
  // global-setup armed one unread accepted chat, so the button's aria-label
  // reflects the count (MessagesNavButton: "Messages, N unread").
  await expect(page.getByRole("link", { name: /unread/ })).toBeVisible();
});
