import { Suspense } from "react";

import { IntegrityMediaSsoComplete } from "../../../../features/external-author-link/IntegrityMediaSsoComplete";

import "../../../../features/auth/components/auth-form.css";

export default function IntegrityMediaSsoPage() {
  return (
    <main className="auth-page">
      <Suspense fallback={<p className="auth-page__subtitle">Signing you in to Humanity Union.</p>}>
        <IntegrityMediaSsoComplete />
      </Suspense>
    </main>
  );
}
