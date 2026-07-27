import { ConfirmEmailForm } from "../../features/auth/components/ConfirmEmailForm";

import "../../features/auth/components/auth-form.css";

export default function ConfirmEmailPage() {
  return (
    <main className="auth-page">
      <header className="auth-page__header">
        <h1 className="auth-page__title">Confirm Email</h1>
        <p className="auth-page__subtitle">
          Enter the six-digit code we sent to confirm access to your email address.
        </p>
      </header>
      <ConfirmEmailForm />
    </main>
  );
}
