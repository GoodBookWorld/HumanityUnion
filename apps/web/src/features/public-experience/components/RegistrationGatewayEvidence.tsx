"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { REGISTRATION_ROUTE } from "../footer-links";

export function RegistrationGatewayEvidence() {
  const t = useTranslations("publicGeo.shared.registration");

  return (
    <div className="registration-gateway">
      <p className="registration-gateway__invitation">{t("invitation")}</p>
      <p className="registration-gateway__exploration-note">{t("explorationNote")}</p>

      <div className="registration-gateway__actions">
        <Link className="registration-gateway__action" href={REGISTRATION_ROUTE}>
          {t("actionLabel")}
        </Link>
      </div>

      <p className="registration-gateway__about">
        <Link href="/knowledge" className="registration-gateway__about-link">
          {t("learnAbout")}
        </Link>
      </p>
    </div>
  );
}
