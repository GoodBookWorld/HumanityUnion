import { Suspense } from "react";

import { SuspensionReviewRequestForm } from "../../../features/administration/components/SuspensionReviewRequestForm";

import "../../../features/auth/components/auth-form.css";

/**
 * Pack 24B — public/token-only suspension review request.
 * No authentication gate — valid opaque token required via query string.
 */
export default function SuspensionReviewPage() {
  return (
    <main className="auth-page">
      <header className="auth-page__header">
        <h1 className="auth-page__title">Request an account review</h1>
        <p className="auth-page__subtitle">
          Explain why access should be restored. Sign-in is not required for this request.
        </p>
      </header>
      <Suspense fallback={<p className="hu-body">Loading review form…</p>}>
        <SuspensionReviewRequestForm />
      </Suspense>
    </main>
  );
}
