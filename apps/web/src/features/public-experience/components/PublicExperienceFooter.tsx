import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { resolveBrandForMetadata } from "../../brand-localization/resolve-brand-for-metadata";
import { FOOTER_COPYRIGHT_YEAR } from "../constants";
import {
  FOOTER_LEGAL_LINKS,
  FOOTER_PLATFORM_COLUMN_ONE,
  FOOTER_PLATFORM_COLUMN_TWO,
  type FooterLink,
} from "../footer-links";
import { resolveFooterNavDisplayLabel } from "../footer-nav-i18n";
import { FooterSocialLinks } from "./FooterSocialLinks";

function FooterNavItem({
  link,
  displayLabel,
}: {
  link: FooterLink;
  displayLabel: string;
}) {
  if (link.status === "active" && link.href) {
    return (
      <li>
        <Link href={link.href} className="public-experience-footer__nav-link">
          {link.iconSrc ? (
            <img
              className="public-experience-footer__nav-icon"
              src={link.iconSrc}
              alt=""
              aria-hidden="true"
              width={24}
              height={24}
            />
          ) : null}
          <span>{displayLabel}</span>
        </Link>
      </li>
    );
  }

  return null;
}

export async function PublicExperienceFooter() {
  const tNav = await getTranslations("navigation");
  const locale = await getLocale();
  const brand = await resolveBrandForMetadata(locale);
  const copyright = tNav("footerCopyright", {
    year: FOOTER_COPYRIGHT_YEAR,
    siteName: brand.siteName,
  });

  return (
    <footer
      id="footer"
      className="public-experience-footer"
      data-block="Footer"
      data-stage="Supporting Navigation"
    >
      <div className="public-experience-footer__inner">
        <div className="public-experience-footer__grid">
          <section className="public-experience-footer__block public-experience-footer__brand">
            <div className="public-experience-footer__brand-row">
              <Link
                href="/"
                className="public-experience-footer__logo-link"
                aria-label={`${brand.siteName} home`}
              >
                <img
                  src="/brand/humanity-union-logo.svg"
                  alt=""
                  className="public-experience-footer__logo"
                  width={40}
                  height={40}
                />
              </Link>
              <div className="public-experience-footer__brand-text">
                <p className="public-experience-footer__identity">{brand.siteName}</p>
                <p className="public-experience-footer__tagline">{brand.slogan}</p>
              </div>
            </div>
            <p className="public-experience-footer__mission">{tNav("footerMission")}</p>
            <FooterSocialLinks />
          </section>

          <section className="public-experience-footer__block public-experience-footer__platform">
            <h2 className="public-experience-footer__heading public-experience-footer__heading--platform">
              {tNav("footerPlatformHeading")}
            </h2>
            <div className="public-experience-footer__platform-columns">
              <nav aria-label="Platform navigation column one">
                <ul className="public-experience-footer__nav-list">
                  {FOOTER_PLATFORM_COLUMN_ONE.map((link) => (
                    <FooterNavItem
                      key={`platform-one:${link.href ?? link.label}`}
                      link={link}
                      displayLabel={resolveFooterNavDisplayLabel(link.label, tNav)}
                    />
                  ))}
                </ul>
              </nav>
              <nav aria-label="Platform navigation column two">
                <ul className="public-experience-footer__nav-list">
                  {FOOTER_PLATFORM_COLUMN_TWO.map((link) => (
                    <FooterNavItem
                      key={`platform-two:${link.href ?? link.label}`}
                      link={link}
                      displayLabel={resolveFooterNavDisplayLabel(link.label, tNav)}
                    />
                  ))}
                </ul>
              </nav>
            </div>
          </section>

          <section className="public-experience-footer__block public-experience-footer__block--legal">
            <h2 className="public-experience-footer__heading">
              {tNav("footerLegalHeading")}
            </h2>
            <nav aria-label="Legal and transparency navigation">
              <ul className="public-experience-footer__nav-list public-experience-footer__nav-list--legal">
                {FOOTER_LEGAL_LINKS.map((link) => (
                  <FooterNavItem
                    key={`legal:${link.href ?? link.label}`}
                    link={link}
                    displayLabel={resolveFooterNavDisplayLabel(link.label, tNav)}
                  />
                ))}
              </ul>
            </nav>
          </section>
        </div>

        <p className="public-experience-footer__copyright">{copyright}</p>
      </div>
    </footer>
  );
}
