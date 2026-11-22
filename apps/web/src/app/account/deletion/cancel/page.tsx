import { getTranslations } from "next-intl/server";

import { isAccountDeletionUiEnabled } from "../../../../features/account-deletion/account-deletion-availability";
import { AccountDeletionRecoveryForm } from "../../../../features/account-deletion/AccountDeletionRecoveryForm";

import "../../../../features/auth/components/auth-form.css";

export default async function AccountDeletionRecoveryPage() {
  const t = await getTranslations("auth");
  const enabled = isAccountDeletionUiEnabled();

  return (
    <main className="auth-page">
      <header className="auth-page__header">
        <h1 className="auth-page__title">{enabled ? t("recoveryTitle") : t("deleteAccountUnavailable")}</h1>
        {enabled ? <p className="auth-page__subtitle">{t("recoveryIntro")}</p> : null}
      </header>
      {enabled ? <AccountDeletionRecoveryForm /> : null}
    </main>
  );
}
