import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";

import { MemberWorkspace } from "../../components/member/MemberWorkspace";
import { resolveBrandForMetadata } from "../../features/brand-localization/resolve-brand-for-metadata";
import { AccountPanel } from "../../features/auth/components/AccountPanel";
import { WorkspaceNavigation } from "../../features/initiatives/components/WorkspaceNavigation";

export default async function AccountPage() {
  const locale = await getLocale();
  const brand = await resolveBrandForMetadata(locale);
  const t = await getTranslations("workspace");

  return (
    <main className="humanity-workspace-page">
      <MemberWorkspace
        title={t("account")}
        subtitle={t("accountSubtitle", { siteName: brand.siteName })}
        workspaceNavigation={<WorkspaceNavigation />}
      >
        <Suspense fallback={<p>{t("loadingAccount")}</p>}>
          <AccountPanel />
        </Suspense>
      </MemberWorkspace>
    </main>
  );
}
