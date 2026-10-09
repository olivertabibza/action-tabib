import { redirect } from "next/navigation";

// /network was split in Phase 2: finding people moved to /explore/people, and
// your own connections moved to the Network sub-tab on Profile.
export default function NetworkPage() {
  redirect("/profile/network");
}
