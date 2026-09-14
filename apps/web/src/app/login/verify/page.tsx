import { getTranslations } from "next-intl/server";

import { LoginVerifyForm } from "../../../features/auth/components/LoginVerifyForm";

import "../../../features/auth/components/auth-form.css";

export default async function LoginVerifyPage() {
  const t = await getTranslations("auth");

  return (
    <main className="auth-page">
      <header className="auth-page__header">
        <h1 className="auth-page__title">{t("verifyLoginTitle")}</h1>
        <p className="auth-page__subtitle">{t("verifyLoginSubtitle")}</p>
      </header>
      <LoginVerifyForm />
    </main>
  );
}
