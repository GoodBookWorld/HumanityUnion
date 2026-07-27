"use client";

import { useRouter } from "next/navigation";

import type { CivicNominationInstitutionRole } from "@hu/types";

import { Button } from "../../../design-system";
import { getStoredAccessToken } from "../../auth/auth-token-store";
import { civicNominationFormPath } from "../constants";

interface CreateNominationButtonProps {
  role: CivicNominationInstitutionRole;
}

export function CreateNominationButton({ role }: CreateNominationButtonProps) {
  const router = useRouter();
  const formPath = civicNominationFormPath(role);

  function handleClick() {
    if (!getStoredAccessToken()) {
      router.push(`/login?returnTo=${encodeURIComponent(formPath)}`);
      return;
    }

    router.push(formPath);
  }

  return (
    <Button type="button" variant="primary" onClick={handleClick}>
      Create Nomination
    </Button>
  );
}
