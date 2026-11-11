import type { Metadata } from "next";

// The login page is a client component, which can't export metadata (UX B-32).
export const metadata: Metadata = { title: "Log in" };

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
