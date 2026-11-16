"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";

import { useLocalizedBrand } from "../../brand-localization/useLocalizedBrand";
import { Button } from "../../../design-system/components/Button";
import {
  REGIONAL_PROGRAM_ACTIVITY_ICONS,
  REGIONAL_PROGRAM_ASSETS,
  REGIONAL_PROGRAM_BENEFIT_ICON,
  REGIONAL_PROGRAM_JOIN_MAILTO,
  REGIONAL_PROGRAM_PRINCIPLE_ICON,
  REGIONAL_PROGRAM_TOOL_ICONS,
  REGIONAL_PROGRAM_VOLUNTEER_HREF,
} from "../regional-program.constants";
import { RegionalProgramIcon } from "./RegionalProgramIcon";

import "../regional-program-page.css";

const ACTIVITY_ITEMS = [
  { key: "unite", icon: REGIONAL_PROGRAM_ACTIVITY_ICONS.unite },
  { key: "education", icon: REGIONAL_PROGRAM_ACTIVITY_ICONS.education },
  { key: "initiatives", icon: REGIONAL_PROGRAM_ACTIVITY_ICONS.initiatives },
  { key: "partnerships", icon: REGIONAL_PROGRAM_ACTIVITY_ICONS.partnerships },
] as const;

const TOOL_ITEMS = [
  { key: "initiatives", icon: REGIONAL_PROGRAM_TOOL_ICONS.initiatives },
  { key: "proposals", icon: REGIONAL_PROGRAM_TOOL_ICONS.proposals },
  { key: "decisions", icon: REGIONAL_PROGRAM_TOOL_ICONS.decisions },
  { key: "media", icon: REGIONAL_PROGRAM_TOOL_ICONS.media },
  { key: "discussions", icon: REGIONAL_PROGRAM_TOOL_ICONS.discussions },
  { key: "petitions", icon: REGIONAL_PROGRAM_TOOL_ICONS.petitions },
  { key: "tracking", icon: REGIONAL_PROGRAM_TOOL_ICONS.tracking },
  { key: "workspace", icon: REGIONAL_PROGRAM_TOOL_ICONS.workspace },
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

/** Full-bleed LTR/RTL photograph layer behind banner copy. */
function BannerMedia({
  ltrSrc,
  rtlSrc,
  width,
  height,
  fit,
}: {
  readonly ltrSrc: string;
  readonly rtlSrc: string;
  readonly width: number;
  readonly height: number;
  /** Hero uses cover; final CTA may stretch to fill the container. */
  readonly fit: "cover" | "fill";
}) {
  const fitClass =
    fit === "fill"
      ? "regional-program-page__banner-image--fill"
      : "regional-program-page__banner-image--cover";

  return (
    <div className="regional-program-page__banner-media" aria-hidden="true">
      <Image
        src={ltrSrc}
        alt=""
        width={width}
        height={height}
        className={`regional-program-page__banner-image regional-program-page__banner-image--ltr ${fitClass}`}
        sizes="100vw"
        priority={fit === "cover"}
      />
      <Image
        src={rtlSrc}
        alt=""
        width={width}
        height={height}
        className={`regional-program-page__banner-image regional-program-page__banner-image--rtl ${fitClass}`}
        sizes="100vw"
      />
    </div>
  );
}

export function RegionalProgramPageContent() {
  const t = useTranslations("regionalProgramPublic");
  const brand = useLocalizedBrand();
  const siteName = { siteName: brand.siteName };

  return (
    <div className="regional-program-page">
      <header className="regional-program-page__hero">
        <BannerMedia
          ltrSrc={REGIONAL_PROGRAM_ASSETS.hero}
          rtlSrc={REGIONAL_PROGRAM_ASSETS.heroRtl}
          width={1888}
          height={544}
          fit="cover"
        />
        <div className="regional-program-page__banner-copy regional-program-page__hero-copy">
          <p className="regional-program-page__eyebrow">{t("eyebrow")}</p>
          <h1 className="regional-program-page__title">{t("title", siteName)}</h1>
          <p className="regional-program-page__subtitle">{t("subtitle")}</p>
          <p className="regional-program-page__description">{t("description", siteName)}</p>
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
        <p className="regional-program-page__body">{t("mission.body", siteName)}</p>
      </section>

      <section
        className="regional-program-page__section"
        aria-labelledby="regional-program-activities-heading"
      >
        <h2 id="regional-program-activities-heading" className="regional-program-page__heading">
          {t("activities.heading")}
        </h2>
        <ul className="regional-program-page__card-grid">
          {ACTIVITY_ITEMS.map((item) => (
            <li key={item.key} className="regional-program-page__card">
              <RegionalProgramIcon
                src={item.icon}
                className="regional-program-page__icon regional-program-page__icon--activity"
                size={42}
              />
              <h3 className="regional-program-page__card-title">
                {t(`activities.items.${item.key}.title`)}
              </h3>
              <p className="regional-program-page__card-body">
                {t(`activities.items.${item.key}.body`, siteName)}
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
          <p className="regional-program-page__body">{t("tools.body", siteName)}</p>
          <ul className="regional-program-page__tool-card-grid">
            {TOOL_ITEMS.map((item) => (
              <li key={item.key} className="regional-program-page__tool-card">
                <RegionalProgramIcon
                  src={item.icon}
                  className="regional-program-page__icon regional-program-page__icon--tool"
                  size={40}
                />
                <span className="regional-program-page__tool-card-title">
                  {t(`tools.items.${item.key}`)}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="regional-program-page__section-media">
          <Image
            src={REGIONAL_PROGRAM_ASSETS.tools}
            alt={t("tools.imageAlt", siteName)}
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
        <ul className="regional-program-page__benefit-strip">
          {BENEFIT_ITEMS.map((key) => (
            <li key={key} className="regional-program-page__benefit-item">
              <RegionalProgramIcon
                src={REGIONAL_PROGRAM_BENEFIT_ICON}
                className="regional-program-page__icon regional-program-page__icon--benefit"
                size={36}
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
        <ol className="regional-program-page__timeline">
          {DEVELOPMENT_STEPS.map((key, index) => (
            <li key={key} className="regional-program-page__timeline-step">
              <div className="regional-program-page__timeline-marker">
                <span className="regional-program-page__timeline-number" aria-hidden="true">
                  {index + 1}
                </span>
                {index < DEVELOPMENT_STEPS.length - 1 ? (
                  <span className="regional-program-page__timeline-connector" aria-hidden="true" />
                ) : null}
              </div>
              <div className="regional-program-page__timeline-copy">
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
            alt={t("presence.imageAlt", siteName)}
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
                src={REGIONAL_PROGRAM_PRINCIPLE_ICON}
                className="regional-program-page__icon regional-program-page__icon--principle"
                size={28}
              />
              <span>{t(`principles.items.${key}`, siteName)}</span>
            </li>
          ))}
        </ul>
        <p className="regional-program-page__legal">{t("principles.legal", siteName)}</p>
      </section>

      <section
        className="regional-program-page__final-cta"
        aria-labelledby="regional-program-final-cta-heading"
      >
        <BannerMedia
          ltrSrc={REGIONAL_PROGRAM_ASSETS.cta}
          rtlSrc={REGIONAL_PROGRAM_ASSETS.ctaRtl}
          width={1024}
          height={380}
          fit="fill"
        />
        <div className="regional-program-page__banner-copy regional-program-page__final-cta-copy">
          <h2 id="regional-program-final-cta-heading" className="regional-program-page__heading">
            {t("finalCta.heading")}
          </h2>
          <p className="regional-program-page__body">{t("finalCta.body", siteName)}</p>
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
