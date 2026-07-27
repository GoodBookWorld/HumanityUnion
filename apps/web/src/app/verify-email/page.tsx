import { Suspense } from "react";

import { VerifyEmailPanel } from "../../features/auth/components/VerifyEmailPanel";

import "../../features/auth/components/auth-form.css";

export default function VerifyEmailPage() {
  return (
    <main className="auth-page">
      <header className="auth-page__header">
        <h1 className="auth-page__title">Verify email</h1>
        <p className="auth-page__subtitle">Confirm your Humanity Union account email address.</p>
      </header>
      <Suspense fallback={<p>Loading verification...</p>}>
        <VerifyEmailPanel />
      </Suspense>
    </main>
  );
}
