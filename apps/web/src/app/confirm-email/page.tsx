import { getTranslations } from "next-intl/server";

import { ConfirmEmailForm } from "../../features/auth/components/ConfirmEmailForm";

import "../../features/auth/components/auth-form.css";

export default async function ConfirmEmailPage() {
  const t = await getTranslations("auth");

  return (
    <main className="auth-page">
      <header className="auth-page__header">
        <h1 className="auth-page__title">{t("confirmEmailTitle")}</h1>
        <p className="auth-page__subtitle">{t("confirmEmailSubtitle")}</p>
      </header>
      <ConfirmEmailForm />
    </main>
  );
}
