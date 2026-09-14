import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { MemberWorkspace } from "../../components/member/MemberWorkspace";
import { AccountPanel } from "../../features/auth/components/AccountPanel";
import { WorkspaceNavigation } from "../../features/initiatives/components/WorkspaceNavigation";

export default async function AccountPage() {
  const t = await getTranslations("workspace");

  return (
    <main className="humanity-workspace-page">
      <MemberWorkspace
        title={t("account")}
        subtitle={t("accountSubtitle")}
        workspaceNavigation={<WorkspaceNavigation />}
      >
        <Suspense fallback={<p>{t("loadingAccount")}</p>}>
          <AccountPanel />
        </Suspense>
      </MemberWorkspace>
    </main>
  );
}
