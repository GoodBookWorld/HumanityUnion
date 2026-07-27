import { PasswordResetRequestForm } from "../../features/auth/components/PasswordResetRequestForm";

import "../../features/auth/components/auth-form.css";

export default function PasswordResetPage() {
  return (
    <main className="auth-page">
      <header className="auth-page__header">
        <h1 className="auth-page__title">Reset password</h1>
        <p className="auth-page__subtitle">
          Request a secure password reset link for your account.
        </p>
      </header>
      <PasswordResetRequestForm />
    </main>
  );
}
