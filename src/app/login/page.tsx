import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <AuthShell
      headline="Pick up where your ledger left off."
      sub="Balances, budgets and shared splits — exactly as you left them, on every device."
    >
      <LoginForm next={next || "/"} />
    </AuthShell>
  );
}
