import { Suspense } from "react";

import { PasswordResetConfirmForm } from "../../../features/auth/components/PasswordResetConfirmForm";

import "../../../features/auth/components/auth-form.css";

export default function PasswordResetConfirmPage() {
  return (
    <main className="auth-page">
      <header className="auth-page__header">
        <h1 className="auth-page__title">Choose a new password</h1>
        <p className="auth-page__subtitle">Set a new password for your Humanity Union account.</p>
      </header>
      <Suspense fallback={<p>Loading reset form...</p>}>
        <PasswordResetConfirmForm />
      </Suspense>
    </main>
  );
}
