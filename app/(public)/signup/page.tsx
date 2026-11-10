import { SignupForm } from "./signup-form";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  return (
    <SignupForm type={type === "fan" || type === "creator" ? type : null} />
  );
}
