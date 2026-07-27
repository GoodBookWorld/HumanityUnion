import { Suspense } from "react";

import { ConfirmEmailChangePanel } from "../../features/auth/components/ConfirmEmailChangePanel";

import "../../features/auth/components/auth-form.css";

export default function ConfirmEmailChangePage() {
  return (
    <main className="auth-page">
      <header className="auth-page__header">
        <h1 className="auth-page__title">Confirm email change</h1>
        <p className="auth-page__subtitle">Finish updating your Humanity Union account email.</p>
      </header>
      <Suspense fallback={<p>Loading confirmation...</p>}>
        <ConfirmEmailChangePanel />
      </Suspense>
    </main>
  );
}
