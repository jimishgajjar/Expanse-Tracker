import { AuthShell } from "@/components/auth-shell";
import { SignupForm } from "@/components/signup-form";

export default function SignupPage() {
  return (
    <AuthShell
      headline="Every rupee, clearly accounted for."
      sub="Start with a blank ledger and one transaction. Budgets, subscriptions and shared splits are there when you want them."
    >
      <SignupForm />
    </AuthShell>
  );
}
