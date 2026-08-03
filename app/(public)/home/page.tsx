import { redirect } from "next/navigation";

/**
 * /home is retired. The public homepage at "/" is now login-state-aware: it
 * renders marketing for logged-out visitors and dispatches logged-in users to
 * their app (pros → /dashboard, consumers → /fan). This page just forwards to
 * "/" so older links keep working.
 */
export default async function HomePage() {
  redirect("/");
}
