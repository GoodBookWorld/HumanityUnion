"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";

import { Button } from "../../../design-system/components/Button";
import {
  REGIONAL_PROGRAM_ASSETS,
  REGIONAL_PROGRAM_ICONS,
  REGIONAL_PROGRAM_JOIN_MAILTO,
  REGIONAL_PROGRAM_VOLUNTEER_HREF,
} from "../regional-program.constants";
import { RegionalProgramIcon } from "./RegionalProgramIcon";

import "../regional-program-page.css";

const ACTIVITY_ITEMS = [
  { key: "unite", icon: REGIONAL_PROGRAM_ICONS.unite },
  { key: "education", icon: REGIONAL_PROGRAM_ICONS.education },
  { key: "initiatives", icon: REGIONAL_PROGRAM_ICONS.initiatives },
  { key: "partnerships", icon: REGIONAL_PROGRAM_ICONS.partnerships },
] as const;

const TOOL_ITEMS = [
  { key: "initiatives", icon: REGIONAL_PROGRAM_ICONS.initiatives },
  { key: "discussions", icon: REGIONAL_PROGRAM_ICONS.discussions },
  { key: "proposals", icon: REGIONAL_PROGRAM_ICONS.proposals },
  { key: "petitions", icon: REGIONAL_PROGRAM_ICONS.petitions },
  { key: "decisions", icon: REGIONAL_PROGRAM_ICONS.decisions },
  { key: "tracking", icon: REGIONAL_PROGRAM_ICONS.tracking },
  { key: "media", icon: REGIONAL_PROGRAM_ICONS.media },
  { key: "workspace", icon: REGIONAL_PROGRAM_ICONS.workspace },
] as const;

const BENEFIT_ITEMS = [
  "skills",
  "connections",
  "experience",
  "contribution",
  "pathway",
] as const;

const DEVELOPMENT_STEPS = [
  "volunteer",
  "initiative",
  "cooperation",
  "team",
  "expand",
] as const;

const PRINCIPLE_ITEMS = [
  "voluntary",
  "openness",
  "transparency",
  "respect",
  "cooperation",
  "publicBenefit",
  "results",
  "name",
] as const;

function JoinProgramButton({
  label,
  className,
}: {
  readonly label: string;
  readonly className?: string;
}) {
  return (
    <a
      href={REGIONAL_PROGRAM_JOIN_MAILTO}
      className={["hu-button", "hu-button--primary", className].filter(Boolean).join(" ")}
    >
      {label}
    </a>
  );
}

export function RegionalProgramPageContent() {
  const t = useTranslations("regionalProgramPublic");

  return (
    <div className="regional-program-page">
      <header className="regional-program-page__hero">
        <div className="regional-program-page__hero-copy">
          <p className="regional-program-page__eyebrow">{t("eyebrow")}</p>
          <h1 className="regional-program-page__title">{t("title")}</h1>
          <p className="regional-program-page__subtitle">{t("subtitle")}</p>
          <p className="regional-program-page__description">{t("description")}</p>
          <div className="regional-program-page__hero-actions">
            <JoinProgramButton label={t("cta.join")} />
            <Button href={REGIONAL_PROGRAM_VOLUNTEER_HREF} variant="secondary">
              {t("cta.volunteer")}
            </Button>
          </div>
        </div>
      </header>

      <section
        className="regional-program-page__section"
        aria-labelledby="regional-program-mission-heading"
      >
        <h2 id="regional-program-mission-heading" className="regional-program-page__heading">
          {t("mission.heading")}
        </h2>
        <p className="regional-program-page__body">{t("mission.body")}</p>
      </section>

      <section
        className="regional-program-page__section"
        aria-labelledby="regional-program-activities-heading"
      >
        <h2 id="regional-program-activities-heading" className="regional-program-page__heading">
          {t("activities.heading")}
        </h2>
        <ul className="regional-program-page__card-grid">
          {ACTIVITY_ITEMS.map((item, index) => (
            <li key={item.key} className="regional-program-page__card">
              <div className="regional-program-page__card-top">
                <span className="regional-program-page__card-number" aria-hidden="true">
                  {index + 1}
                </span>
                <RegionalProgramIcon
                  src={item.icon}
                  className="regional-program-page__icon"
                  size={32}
                />
              </div>
              <h3 className="regional-program-page__card-title">
                {t(`activities.items.${item.key}.title`)}
              </h3>
              <p className="regional-program-page__card-body">
                {t(`activities.items.${item.key}.body`)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section
        className="regional-program-page__section regional-program-page__section--split"
        aria-labelledby="regional-program-tools-heading"
      >
        <div className="regional-program-page__section-copy">
          <h2 id="regional-program-tools-heading" className="regional-program-page__heading">
            {t("tools.heading")}
          </h2>
          <p className="regional-program-page__body">{t("tools.body")}</p>
          <ul className="regional-program-page__tool-list">
            {TOOL_ITEMS.map((item) => (
              <li key={item.key} className="regional-program-page__tool-item">
                <RegionalProgramIcon
                  src={item.icon}
                  className="regional-program-page__icon regional-program-page__icon--sm"
                  size={24}
                />
                <span>{t(`tools.items.${item.key}`)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="regional-program-page__section-media">
          <Image
            src={REGIONAL_PROGRAM_ASSETS.tools}
            alt={t("tools.imageAlt")}
            width={960}
            height={640}
            className="regional-program-page__inline-image"
          />
        </div>
      </section>

      <section
        className="regional-program-page__section"
        aria-labelledby="regional-program-benefits-heading"
      >
        <h2 id="regional-program-benefits-heading" className="regional-program-page__heading">
          {t("benefits.heading")}
        </h2>
        <ul className="regional-program-page__benefit-list">
          {BENEFIT_ITEMS.map((key) => (
            <li key={key} className="regional-program-page__benefit-item">
              <RegionalProgramIcon
                src={REGIONAL_PROGRAM_ICONS.benefit}
                className="regional-program-page__icon regional-program-page__icon--sm"
                size={24}
              />
              <span>{t(`benefits.items.${key}`)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section
        className="regional-program-page__section"
        aria-labelledby="regional-program-development-heading"
      >
        <h2 id="regional-program-development-heading" className="regional-program-page__heading">
          {t("development.heading")}
        </h2>
        <p className="regional-program-page__body">{t("development.intro")}</p>
        <ol className="regional-program-page__steps">
          {DEVELOPMENT_STEPS.map((key, index) => (
            <li key={key} className="regional-program-page__step">
              <span className="regional-program-page__step-number" aria-hidden="true">
                {index + 1}
              </span>
              <div className="regional-program-page__step-copy">
                <h3 className="regional-program-page__step-title">
                  {t(`development.steps.${key}.title`)}
                </h3>
                <p className="regional-program-page__step-body">
                  {t(`development.steps.${key}.body`)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section
        className="regional-program-page__section regional-program-page__section--split regional-program-page__section--split-reverse"
        aria-labelledby="regional-program-presence-heading"
      >
        <div className="regional-program-page__section-copy">
          <h2 id="regional-program-presence-heading" className="regional-program-page__heading">
            {t("presence.heading")}
          </h2>
          <p className="regional-program-page__body">{t("presence.body")}</p>
          <p className="regional-program-page__notice" role="note">
            {t("presence.notice")}
          </p>
        </div>
        <div className="regional-program-page__section-media">
          <Image
            src={REGIONAL_PROGRAM_ASSETS.presence}
            alt={t("presence.imageAlt")}
            width={960}
            height={640}
            className="regional-program-page__inline-image"
          />
        </div>
      </section>

      <section
        className="regional-program-page__section"
        aria-labelledby="regional-program-principles-heading"
      >
        <h2 id="regional-program-principles-heading" className="regional-program-page__heading">
          {t("principles.heading")}
        </h2>
        <ul className="regional-program-page__principle-grid">
          {PRINCIPLE_ITEMS.map((key) => (
            <li key={key} className="regional-program-page__principle-item">
              <RegionalProgramIcon
                src={REGIONAL_PROGRAM_ICONS.principle}
                className="regional-program-page__icon regional-program-page__icon--sm"
                size={22}
              />
              <span>{t(`principles.items.${key}`)}</span>
            </li>
          ))}
        </ul>
        <p className="regional-program-page__legal">{t("principles.legal")}</p>
      </section>

      <section
        className="regional-program-page__final-cta"
        aria-labelledby="regional-program-final-cta-heading"
      >
        <div className="regional-program-page__final-cta-copy">
          <h2 id="regional-program-final-cta-heading" className="regional-program-page__heading">
            {t("finalCta.heading")}
          </h2>
          <p className="regional-program-page__body">{t("finalCta.body")}</p>
          <div className="regional-program-page__hero-actions">
            <JoinProgramButton label={t("cta.join")} />
            <Button href={REGIONAL_PROGRAM_VOLUNTEER_HREF} variant="secondary">
              {t("cta.volunteer")}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
