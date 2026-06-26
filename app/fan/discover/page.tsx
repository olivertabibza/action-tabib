import { redirect } from "next/navigation";

// Discover merged into Explore — redirect so old links don't break.
export default function FanDiscoverPage() {
  redirect("/fan/explore");
}
