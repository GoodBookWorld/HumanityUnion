import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { ConfirmEmailChangePanel } from "../../features/auth/components/ConfirmEmailChangePanel";

import "../../features/auth/components/auth-form.css";

export default async function ConfirmEmailChangePage() {
  const t = await getTranslations("auth");

  return (
    <main className="auth-page">
      <header className="auth-page__header">
        <h1 className="auth-page__title">{t("confirmEmailChangeTitle")}</h1>
        <p className="auth-page__subtitle">{t("confirmEmailChangeSubtitle")}</p>
      </header>
      <Suspense fallback={<p>{t("loadingVerification")}</p>}>
        <ConfirmEmailChangePanel />
      </Suspense>
    </main>
  );
}
