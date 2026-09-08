"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Button } from "../../../design-system/components/Button";
import { Card } from "../../../design-system/components/Card";
import {
  VOLUNTEER_ASSETS,
  VOLUNTEER_CREATE_INITIATIVE_HREF,
} from "../volunteer.constants";

import "../volunteer-page.css";

function RichMarks({
  children,
}: {
  children: (tags: {
    platform: (chunks: ReactNode) => ReactNode;
    emphasis: (chunks: ReactNode) => ReactNode;
  }) => ReactNode;
}) {
  return (
    <>
      {children({
        platform: (chunks) => <strong>{chunks}</strong>,
        emphasis: (chunks) => <strong>{chunks}</strong>,
      })}
    </>
  );
}

const VALUE_ITEMS = [
  { key: "people", icon: VOLUNTEER_ASSETS.people },
  { key: "ideas", icon: VOLUNTEER_ASSETS.greenHome },
  { key: "together", icon: VOLUNTEER_ASSETS.planet },
] as const;

const ACTION_ITEMS = [
  { key: "support", icon: VOLUNTEER_ASSETS.team },
  { key: "participate", icon: VOLUNTEER_ASSETS.chat },
  { key: "create", icon: VOLUNTEER_ASSETS.bulb },
  { key: "help", icon: VOLUNTEER_ASSETS.settings },
  { key: "safely", icon: VOLUNTEER_ASSETS.protect },
] as const;

export function VolunteerPageContent() {
  const t = useTranslations("volunteerPublic");

  return (
    <div className="volunteer-page">
      <header className="volunteer-page__hero">
        <div className="volunteer-page__hero-copy">
          <p className="volunteer-page__eyebrow">{t("eyebrow")}</p>
          <h1 className="volunteer-page__title">{t("title")}</h1>
          <p className="volunteer-page__lead">{t("lead")}</p>
          <ul className="volunteer-page__values">
            {VALUE_ITEMS.map((item) => (
              <li key={item.key} className="volunteer-page__value">
                <Image
                  src={item.icon}
                  alt=""
                  width={36}
                  height={36}
                  className="volunteer-page__value-icon"
                  unoptimized
                />
                <div className="volunteer-page__value-copy">
                  <span className="volunteer-page__value-title">
                    {t(`values.${item.key}.title`)}
                  </span>
                  <span className="volunteer-page__value-text">
                    {t(`values.${item.key}.text`)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="volunteer-page__hero-media">
          <Image
            src={VOLUNTEER_ASSETS.hero}
            alt={t("heroImageAlt")}
            width={720}
            height={480}
            className="volunteer-page__hero-image"
            priority
            unoptimized
          />
        </div>
      </header>

      <section
        className="volunteer-page__section"
        aria-labelledby="volunteer-intro-heading"
      >
        <div className="volunteer-page__section-main">
          <div className="volunteer-page__section-heading-row">
            <span className="volunteer-page__section-number" aria-hidden="true">
              {t("intro.number")}
            </span>
            <div>
              <h2 id="volunteer-intro-heading" className="volunteer-page__section-heading">
                {t("intro.heading")}
              </h2>
              <p className="volunteer-page__section-subheading">{t("intro.subheading")}</p>
            </div>
          </div>
          <div className="volunteer-page__prose">
            <RichMarks>
              {(tags) => (
                <>
                  <p>{t.rich("intro.p1", tags)}</p>
                  <p>{t("intro.p2")}</p>
                  <p>{t("intro.p3")}</p>
                  <p>{t("intro.p4")}</p>
                  <p>{t("intro.p5")}</p>
                  <p>{t("intro.p6")}</p>
                  <p>{t.rich("intro.p7", tags)}</p>
                </>
              )}
            </RichMarks>
          </div>
        </div>
        <aside className="volunteer-page__section-aside">
          <Card className="volunteer-page__visual-card">
            <Image
              src={VOLUNTEER_ASSETS.honeyEarth}
              alt={t("intro.honeyEarthAlt")}
              width={480}
              height={480}
              className="volunteer-page__visual-image"
              unoptimized
            />
          </Card>
        </aside>
      </section>

      <section
        className="volunteer-page__section"
        aria-labelledby="volunteer-meaning-heading"
      >
        <div className="volunteer-page__section-main">
          <div className="volunteer-page__section-heading-row">
            <span className="volunteer-page__section-number" aria-hidden="true">
              {t("meaning.number")}
            </span>
            <div>
              <h2 id="volunteer-meaning-heading" className="volunteer-page__section-heading">
                {t("meaning.heading")}
              </h2>
              <p className="volunteer-page__section-subheading">{t("meaning.subheading")}</p>
            </div>
          </div>
          <div className="volunteer-page__prose">
            <RichMarks>
              {(tags) => (
                <>
                  <p>{t.rich("meaning.p1", tags)}</p>
                  <p>{t("meaning.p2")}</p>
                  <p>{t("meaning.p3")}</p>
                  <p>{t.rich("meaning.p4", tags)}</p>
                  <p>{t.rich("meaning.p5", tags)}</p>
                  <p>{t("meaning.p6")}</p>
                  <p>{t("meaning.p7")}</p>
                  <p>{t("meaning.p8")}</p>
                  <p>{t("meaning.p9")}</p>
                </>
              )}
            </RichMarks>
          </div>
        </div>
        <aside className="volunteer-page__section-aside">
          <Card className="volunteer-page__actions-card">
            <ul className="volunteer-page__actions">
              {ACTION_ITEMS.map((item) => (
                <li key={item.key} className="volunteer-page__action">
                  <Image
                    src={item.icon}
                    alt=""
                    width={40}
                    height={40}
                    className="volunteer-page__action-icon"
                    unoptimized
                  />
                  <div className="volunteer-page__action-copy">
                    <span className="volunteer-page__action-title">
                      {t(`actions.${item.key}.title`)}
                    </span>
                    <span className="volunteer-page__action-text">
                      {t(`actions.${item.key}.text`)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </section>

      <section
        className="volunteer-page__section volunteer-page__section--take-part"
        aria-labelledby="volunteer-take-part-heading"
      >
        <div className="volunteer-page__section-main">
          <div className="volunteer-page__section-heading-row">
            <span className="volunteer-page__section-number" aria-hidden="true">
              {t("takePart.number")}
            </span>
            <div>
              <h2 id="volunteer-take-part-heading" className="volunteer-page__section-heading">
                {t("takePart.heading")}
              </h2>
              <p className="volunteer-page__section-subheading">{t("takePart.subheading")}</p>
            </div>
          </div>
          <div className="volunteer-page__prose">
            <RichMarks>
              {(tags) => (
                <>
                  <p>{t("takePart.p1")}</p>
                  <p>{t("takePart.p2")}</p>
                  <p>{t.rich("takePart.p3", tags)}</p>
                  <p>{t("takePart.p4")}</p>
                  <p>{t("takePart.p5")}</p>
                  <p>{t("takePart.p6")}</p>
                  <p>{t("takePart.p7")}</p>
                  <p>{t("takePart.p8")}</p>
                  <p className="volunteer-page__closing">{t("takePart.closing")}</p>
                </>
              )}
            </RichMarks>
          </div>
        </div>
        <aside className="volunteer-page__section-aside volunteer-page__section-aside--cta">
          <Button href={VOLUNTEER_CREATE_INITIATIVE_HREF} variant="primary">
            {t("createInitiativeCta")}
          </Button>
        </aside>
      </section>
    </div>
  );
}
