"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import type { CivicNominationInstitutionRole } from "@hu/types";

import { Button } from "../../../design-system";
import { useClientAuthStatus } from "../../auth/use-client-auth-status";
import { civicNominationFormPath } from "../constants";

interface CreateNominationButtonProps {
  role: CivicNominationInstitutionRole;
}

export function CreateNominationButton({ role }: CreateNominationButtonProps) {
  const router = useRouter();
  const t = useTranslations("institutionsPublic");
  const authStatus = useClientAuthStatus();
  const formPath = civicNominationFormPath(role);

  function handleClick() {
    if (authStatus !== "authenticated") {
      router.push(`/login?returnTo=${encodeURIComponent(formPath)}`);
      return;
    }

    router.push(formPath);
  }

  return (
    <Button type="button" variant="primary" onClick={handleClick}>
      {t("card.createNomination")}
    </Button>
  );
}
