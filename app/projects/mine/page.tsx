import { redirect } from "next/navigation";

// My projects became two tabs on /projects (UX B-06). Old links still work.
export default function MyProjectsPage() {
  redirect("/projects?tab=postings");
}
