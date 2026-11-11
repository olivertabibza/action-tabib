import { ViewerShell } from "@/components/ViewerShell";

/**
 * /profile (your own, editable) and /profile/[id] (anyone's public profile,
 * open to visitors). Each viewer stays in their own app: pros in ProShell,
 * fans in FanShell, everyone else with the public top nav
 * (components/ViewerShell.tsx, UX B-03). Fans opening /profile itself are sent
 * to /fan/profile by the page.
 */
export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ViewerShell>{children}</ViewerShell>;
}
