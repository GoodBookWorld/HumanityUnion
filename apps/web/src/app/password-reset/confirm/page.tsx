import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { PasswordResetConfirmForm } from "../../../features/auth/components/PasswordResetConfirmForm";

import "../../../features/auth/components/auth-form.css";

export default async function PasswordResetConfirmPage() {
  const t = await getTranslations("auth");

  return (
    <main className="auth-page">
      <header className="auth-page__header">
        <h1 className="auth-page__title">{t("chooseNewPasswordTitle")}</h1>
        <p className="auth-page__subtitle">{t("chooseNewPasswordSubtitle")}</p>
      </header>
      <Suspense fallback={<p>{t("loadingResetForm")}</p>}>
        <PasswordResetConfirmForm />
      </Suspense>
    </main>
  );
}
