"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { useLocalizedBrand } from "../../brand-localization/useLocalizedBrand";

import { Button } from "../../../design-system/components/Button";
import { Card } from "../../../design-system/components/Card";
import { CONTACT_EMAIL, mailtoContactLink } from "../../public-experience/footer-links";
import {
  SUPPORT_ILLUSTRATIONS,
  SUPPORT_LINK_FALLBACKS,
} from "../support.constants";
import {
  fetchPublicSupportOperationalLinks,
  type ResolvedSupportOperationalLinks,
} from "../support-operational-links-api";

import "../support-page.css";

function ExternalButtonLink({
  href,
  variant = "primary",
  children,
  ariaLabel,
}: {
  href: string;
  variant?: "primary" | "secondary";
  children: string;
  ariaLabel?: string;
}) {
  return (
    <a
      href={href}
      className={`hu-button hu-button--${variant}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel ?? children}
    >
      {children}
    </a>
  );
}

function SupportAction({
  href,
  variant = "primary",
  children,
  disabledLabel,
  opensInNewTabLabel,
}: {
  href: string | null;
  variant?: "primary" | "secondary";
  children: string;
  disabledLabel: string;
  opensInNewTabLabel: string;
}) {
  if (!href) {
    return (
      <Button disabled aria-label={disabledLabel}>
        {children}
      </Button>
    );
  }
  if (href.startsWith("/")) {
    return (
      <Button href={href} variant={variant}>
        {children}
      </Button>
    );
  }
  return (
    <ExternalButtonLink href={href} variant={variant} ariaLabel={opensInNewTabLabel}>
      {children}
    </ExternalButtonLink>
  );
}

export function SupportPageContent() {
  const t = useTranslations("supportPublic");
  const brand = useLocalizedBrand();
  const siteName = { siteName: brand.siteName };
  const [links, setLinks] = useState<ResolvedSupportOperationalLinks>({
    donationUrl: SUPPORT_LINK_FALLBACKS.donation,
    volunteerUrl: SUPPORT_LINK_FALLBACKS.volunteer,
    regionalProgramUrl: SUPPORT_LINK_FALLBACKS.regional_program,
  });

  useEffect(() => {
    let cancelled = false;
    void fetchPublicSupportOperationalLinks().then((resolved) => {
      if (!cancelled) {
        setLinks(resolved);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="support-page">
      <header className="support-page__hero">
        <div className="support-page__hero-copy">
          <h1 className="support-page__title">{t("title", siteName)}</h1>
          <p className="support-page__subtitle">{t("subtitle")}</p>
          <div className="support-page__lede">
            <p>{t("lede1", siteName)}</p>
            <p>{t("lede2")}</p>
          </div>
          <p className="support-page__statement">{t("statement", siteName)}</p>
        </div>
        <div className="support-page__hero-media">
          <Image
            src={SUPPORT_ILLUSTRATIONS.hero}
            alt=""
            width={480}
            height={360}
            className="support-page__hero-image"
            priority
          />
        </div>
      </header>

      <section
        id="support-ways"
        className="support-page__section"
        aria-labelledby="support-ways-heading"
      >
        <h2 id="support-ways-heading" className="support-page__section-heading">
          {t("waysHeading")}
        </h2>
        <div className="support-page__cards">
          <Card className="support-page__card">
            <Image
              src={SUPPORT_ILLUSTRATIONS.resources}
              alt=""
              width={44}
              height={44}
              className="support-page__card-icon"
              unoptimized
            />
            <h3 className="support-page__card-title">{t("donate.title")}</h3>
            <p className="support-page__card-body">{t("donate.body")}</p>
            <div className="support-page__card-actions">
              <SupportAction
                href={links.donationUrl}
                disabledLabel={t("donate.disabledLabel")}
                opensInNewTabLabel={t("opensInNewTab", { label: t("donate.cta") })}
              >
                {t("donate.cta")}
              </SupportAction>
            </div>
            <p className="support-page__note">{t("donate.note", siteName)}</p>
          </Card>

          <Card className="support-page__card">
            <Image
              src={SUPPORT_ILLUSTRATIONS.participation}
              alt=""
              width={44}
              height={44}
              className="support-page__card-icon"
              unoptimized
            />
            <h3 className="support-page__card-title">{t("volunteer.title")}</h3>
            <p className="support-page__card-body">{t("volunteer.body")}</p>
            <div className="support-page__card-actions">
              <SupportAction
                href={links.volunteerUrl}
                disabledLabel={t("volunteer.disabledLabel", siteName)}
                opensInNewTabLabel={t("opensInNewTab", { label: t("volunteer.cta", siteName) })}
              >
                {t("volunteer.cta", siteName)}
              </SupportAction>
            </div>
            <p className="support-page__note">
              {links.volunteerUrl ? t("volunteer.noteAvailable") : t("volunteer.noteSoon")}
            </p>
          </Card>

          <Card className="support-page__card">
            <Image
              src={SUPPORT_ILLUSTRATIONS.regional}
              alt=""
              width={44}
              height={44}
              className="support-page__card-icon"
              unoptimized
            />
            <h3 className="support-page__card-title">{t("regional.title")}</h3>
            <p className="support-page__card-body">{t("regional.body", siteName)}</p>
            <div className="support-page__card-actions">
              <SupportAction
                href={links.regionalProgramUrl}
                variant="secondary"
                disabledLabel={t("regional.disabledLabel")}
                opensInNewTabLabel={t("opensInNewTab", { label: t("regional.cta") })}
              >
                {t("regional.cta")}
              </SupportAction>
            </div>
          </Card>
        </div>
      </section>

      <section className="support-page__section" aria-labelledby="why-support-heading">
        <Card className="support-page__why">
          <div className="support-page__why-copy">
            <h2 id="why-support-heading" className="support-page__section-heading">
              {t("why.heading")}
            </h2>
            <p className="support-page__body">{t("why.p1")}</p>
            <p className="support-page__body">{t("why.p2")}</p>
            <p className="support-page__body">{t("why.p3", siteName)}</p>
            <p className="support-page__body">{t("why.p4")}</p>
            <p className="support-page__body">{t("why.p5", siteName)}</p>
          </div>
          <div className="support-page__why-illustration">
            <Image
              src={SUPPORT_ILLUSTRATIONS.why}
              alt={t("why.imageAlt", siteName)}
              width={650}
              height={350}
              className="support-page__why-image"
            />
          </div>
        </Card>
      </section>

      <section className="support-page__section" aria-labelledby="support-forms-heading">
        <h2 id="support-forms-heading" className="support-page__section-heading">
          {t("forms.heading")}
        </h2>
        <div className="support-page__blocks">
          <Card className="support-page__block">
            <h3 className="support-page__block-title">{t("forms.resourcesTitle")}</h3>
            <p className="support-page__block-body">{t("forms.resourcesBody")}</p>
          </Card>
          <Card className="support-page__block">
            <h3 className="support-page__block-title">{t("forms.participationTitle")}</h3>
            <p className="support-page__block-body">{t("forms.participationBody")}</p>
          </Card>
          <Card className="support-page__block">
            <h3 className="support-page__block-title">{t("forms.regionalTitle")}</h3>
            <p className="support-page__block-body">{t("forms.regionalBody")}</p>
          </Card>
        </div>
        <div className="support-page__closing-actions">
          <Button href="#support-ways" variant="primary">
            {t("forms.chooseCta")}
          </Button>
        </div>
        <p className="support-page__contact">
          {t.rich("forms.contactPrompt", {
            email: () => <a href={mailtoContactLink("Support")}>{CONTACT_EMAIL}</a>,
          })}
        </p>
      </section>
    </div>
  );
}
