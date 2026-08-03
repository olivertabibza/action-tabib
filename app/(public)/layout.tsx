import { SiteNav } from "@/components/SiteNav";

/**
 * Layout for the (public) route group: marketing, auth, and holding pages
 * (/, /login, /signup, /welcome, /apply/pending, /onboarding, /for-creators,
 * /for-fans, /home, /auth/error). These routes have no app shell, so the
 * global top nav renders here — the only place besides the shared /profile
 * layout and the public explore detail pages.
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteNav />
      {children}
    </>
  );
}
