import type { Metadata } from "next";

// The page is a client component, which can't export metadata.
export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
