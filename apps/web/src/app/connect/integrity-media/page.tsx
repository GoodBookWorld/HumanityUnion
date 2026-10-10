import { Suspense } from "react";

import { IntegrityMediaLinkConfirm } from "../../../features/external-author-link/IntegrityMediaLinkConfirm";

import "../../../features/auth/components/auth-form.css";

export default function IntegrityMediaLinkPage() {
  return (
    <main className="auth-page">
      <Suspense fallback={<p className="auth-page__subtitle">Loading confirmation.</p>}>
        <IntegrityMediaLinkConfirm />
      </Suspense>
    </main>
  );
}
