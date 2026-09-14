import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { VerifyEmailPanel } from "../../features/auth/components/VerifyEmailPanel";

import "../../features/auth/components/auth-form.css";

export default async function VerifyEmailPage() {
  const t = await getTranslations("auth");

  return (
    <main className="auth-page">
      <header className="auth-page__header">
        <h1 className="auth-page__title">{t("verifyEmailTitle")}</h1>
        <p className="auth-page__subtitle">{t("verifyEmailSubtitle")}</p>
      </header>
      <Suspense fallback={<p>{t("loadingVerification")}</p>}>
        <VerifyEmailPanel />
      </Suspense>
    </main>
  );
}
