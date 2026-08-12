import { AuthShell } from "@/components/auth-shell";
import { ForgotForm } from "@/components/forgot-form";

export default function ForgotPage() {
  return (
    <AuthShell
      headline="Locked out? That's fixable."
      sub="Your data is untouched. Reset the password and everything is where you left it."
    >
      <ForgotForm />
    </AuthShell>
  );
}
