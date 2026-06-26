import { redirect } from "next/navigation";

// Read merged into Explore — redirect so old links don't break.
export default function FanReadPage() {
  redirect("/fan/explore");
}
