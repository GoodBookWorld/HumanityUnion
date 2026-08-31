import { getTranslations } from "next-intl/server";

import { PasswordResetRequestForm } from "../../features/auth/components/PasswordResetRequestForm";

import "../../features/auth/components/auth-form.css";

export default async function PasswordResetPage() {
  const t = await getTranslations("auth");

  return (
    <main className="auth-page">
      <header className="auth-page__header">
        <h1 className="auth-page__title">{t("resetPasswordTitle")}</h1>
        <p className="auth-page__subtitle">{t("resetPasswordSubtitle")}</p>
      </header>
      <PasswordResetRequestForm />
    </main>
  );
}
