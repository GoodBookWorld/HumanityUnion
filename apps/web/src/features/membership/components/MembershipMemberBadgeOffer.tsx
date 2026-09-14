"use client";

import type { MemberBadgeApplicationDetail } from "@hu/types";
import { MEMBER_BADGE_APPLICATION_PRICE_LABEL } from "@hu/types";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Button } from "../../../design-system/components/Button";
import { Card } from "../../../design-system/components/Card";
import { SectionHeader } from "../../../design-system/components/SectionHeader";
import { formatAuthFormError } from "../../../lib/api-client";
import { useClientAuthStatus } from "../../auth/use-client-auth-status";
import { useLocalizedBrand } from "../../brand-localization/useLocalizedBrand";
import {
  getMemberBadgeApplicationAvailability,
  getMyMemberBadgeApplication,
} from "../member-badge-application-api";
import { MEMBER_BADGE_FEATURE_IDS } from "../membership.constants";
import { isActiveMembershipStatus } from "../membership-formatters";
import { getMembershipMe } from "../membership-api";

import { MemberBadgeApplicationModal } from "./MemberBadgeApplicationModal";
import { MemberBadgeApplicationWidget } from "./MemberBadgeApplicationWidget";
import { MemberBadgeIcon } from "./MemberBadgeIcon";

export function MembershipMemberBadgeOffer() {
  const t = useTranslations("membershipPublic");
  const brand = useLocalizedBrand();
  const siteNameValues = { siteName: brand.siteName };
  const authStatus = useClientAuthStatus();
  const [eligible, setEligible] = useState(false);
  const [eligibilityReason, setEligibilityReason] = useState<string | null>(null);
  const [application, setApplication] = useState<MemberBadgeApplicationDetail | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refreshApplication = useCallback(async () => {
    if (authStatus !== "authenticated") {
      setApplication(null);
      return;
    }

    try {
      const current = await getMyMemberBadgeApplication();
      setApplication(current);
      setLoadError(null);
    } catch (error) {
      setApplication(null);
      setLoadError(formatAuthFormError(error));
    }
  }, [authStatus]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        if (authStatus === "authenticated") {
          const membership = await getMembershipMe();
          const isMember = isActiveMembershipStatus(membership.membership.status);
          if (!isMember) {
            if (!cancelled) {
              setEligible(false);
              setEligibilityReason(
                t("badgeProduct.membersOnly", { siteName: brand.siteName }),
              );
              setApplication(null);
            }
            return;
          }
        }

        const availability = await getMemberBadgeApplicationAvailability();
        if (cancelled) {
          return;
        }

        setEligible(availability.eligible);
        setEligibilityReason(availability.reason);

        if (availability.eligible && authStatus === "authenticated") {
          await refreshApplication();
        } else {
          setApplication(null);
        }
      } catch {
        if (!cancelled) {
          setEligible(false);
          setEligibilityReason(t("badgeProduct.unavailable"));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authStatus, brand.siteName, refreshApplication, t]);

  return (
    <>
      <section className="membership-success-section" aria-labelledby="membership-badge-offer-title">
        <SectionHeader title={t("badgeProduct.title")} />
        <Card className="membership-badge-offer">
          <div className="membership-badge-offer__layout">
            <div className="membership-badge-offer__artwork">
              <MemberBadgeIcon size="feature" />
            </div>
            <div className="membership-badge-offer__content">
              <p className="membership-badge-offer__body">
                {t("badgeProduct.body", siteNameValues)}
              </p>
              <p className="membership-badge-offer__subtitle">{t("badgeProduct.subtitle")}</p>
              <ul className="membership-badge-offer__features">
                <li>{t("badgeProduct.productName", siteNameValues)}</li>
                {MEMBER_BADGE_FEATURE_IDS.map((featureId) => (
                  <li key={featureId}>{t(`badgeProduct.features.${featureId}`)}</li>
                ))}
              </ul>
            </div>
            <div className="membership-badge-offer__pricing">
              <p className="membership-badge-offer__price">{MEMBER_BADGE_APPLICATION_PRICE_LABEL}</p>
              <p className="membership-badge-offer__shipping">
                {t("badgeProduct.deliveryIncluded")}
              </p>
              {eligible ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setModalOpen(true)}
                >
                  {t("badgeProduct.ctaLabel")}
                </Button>
              ) : (
                <>
                  <Button type="button" variant="secondary" disabled aria-disabled="true">
                    {t("badgeProduct.ctaLabel")}
                  </Button>
                  {eligibilityReason ? (
                    <p className="membership-badge-offer__note" role="status">
                      {eligibilityReason}
                    </p>
                  ) : null}
                </>
              )}
              {loadError ? (
                <p className="membership-badge-offer__note" role="alert">
                  {loadError}
                </p>
              ) : null}
            </div>
          </div>
        </Card>
      </section>

      {application ? (
        <MemberBadgeApplicationWidget
          application={application}
          onEdit={() => setModalOpen(true)}
        />
      ) : null}

      <MemberBadgeApplicationModal
        isOpen={modalOpen}
        initialAddress={application?.shippingAddress ?? null}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          void refreshApplication();
        }}
      />
    </>
  );
}
