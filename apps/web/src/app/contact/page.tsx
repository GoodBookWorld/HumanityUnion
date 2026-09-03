import { getLocale, getTranslations } from "next-intl/server";

import { resolveBrandForMetadata } from "../../features/brand-localization/resolve-brand-for-metadata";

import {
  CONTACT_EMAIL,
  ORGANIZATION_ADDRESS,
  ORGANIZATION_NAME,
  ORGANIZATION_WEBSITE,
  mailtoContactLink,
} from "../../features/public-experience/footer-links";
import { CONTACT_SUBJECT_IDS } from "../../features/public-experience/contact.constants";

import "../../features/legal/legal-page.css";

export default async function ContactPage() {
  const locale = await getLocale();
  const brand = await resolveBrandForMetadata(locale);
  const siteName = { siteName: brand.siteName };
  const t = await getTranslations("contactPublic");

  return (
    <article className="contact-page">
      <h1>{t("pageTitle")}</h1>
      <p className="contact-page__intro">{t("intro", siteName)}</p>

      <div className="contact-page__details">
        <p>
          <strong>{t("emailLabel")}:</strong>{" "}
          <a href={mailtoContactLink()}>{CONTACT_EMAIL}</a>
        </p>
        <p>
          <strong>{t("organizationLabel")}:</strong> {ORGANIZATION_NAME}
        </p>
        <p>
          <strong>{t("addressLabel")}:</strong> {ORGANIZATION_ADDRESS}
        </p>
        <p>
          <strong>{t("websiteLabel")}:</strong>{" "}
          <a href={ORGANIZATION_WEBSITE}>{ORGANIZATION_WEBSITE}</a>
        </p>
      </div>

      <section aria-labelledby="contact-subjects-heading">
        <h2 id="contact-subjects-heading">{t("subjectsHeading")}</h2>
        <div className="contact-page__subjects">
          {CONTACT_SUBJECT_IDS.map((id) => (
            <a key={id} href={mailtoContactLink(t(`subjects.${id}.subject`))}>
              {t(`subjects.${id}.label`)}
            </a>
          ))}
        </div>
      </section>

      <p className="contact-page__hint">{t("hint", siteName)}</p>
      <p className="contact-page__hint" role="note">
        {t("successChrome")}
      </p>
    </article>
  );
}
