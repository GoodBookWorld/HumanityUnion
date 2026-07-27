import Link from "next/link";

import { FOOTER_COPYRIGHT, FOOTER_MISSION } from "../constants";
import { FOOTER_CONTENT } from "../content";
import {
  FOOTER_LEGAL_LINKS,
  FOOTER_PLATFORM_COLUMN_ONE,
  FOOTER_PLATFORM_COLUMN_TWO,
  type FooterLink,
} from "../footer-links";
import { FooterSocialLinks } from "./FooterSocialLinks";

function FooterNavItem({ link }: { link: FooterLink }) {
  if (link.status === "active" && link.href) {
    return (
      <li>
        <Link href={link.href}>{link.label}</Link>
      </li>
    );
  }

  return null;
}

export function PublicExperienceFooter() {
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
                aria-label="Humanity Union home"
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
                <p className="public-experience-footer__identity">{FOOTER_CONTENT.identity}</p>
                <p className="public-experience-footer__tagline">{FOOTER_CONTENT.tagline}</p>
              </div>
            </div>
            <p className="public-experience-footer__mission">{FOOTER_MISSION}</p>
            <FooterSocialLinks />
          </section>

          <section className="public-experience-footer__block">
            <h2 className="public-experience-footer__heading">{FOOTER_CONTENT.platformHeading}</h2>
            <nav aria-label="Platform navigation column one">
              <ul className="public-experience-footer__nav-list">
                {FOOTER_PLATFORM_COLUMN_ONE.map((link) => (
                  <FooterNavItem key={`platform-one:${link.href ?? link.label}`} link={link} />
                ))}
              </ul>
            </nav>
          </section>

          <section className="public-experience-footer__block public-experience-footer__platform-secondary">
            <h2 className="public-experience-footer__heading public-experience-footer__heading--visually-hidden">
              {FOOTER_CONTENT.platformHeading}
            </h2>
            <nav aria-label="Platform navigation column two">
              <ul className="public-experience-footer__nav-list">
                {FOOTER_PLATFORM_COLUMN_TWO.map((link) => (
                  <FooterNavItem key={`platform-two:${link.href ?? link.label}`} link={link} />
                ))}
              </ul>
            </nav>
          </section>

          <section className="public-experience-footer__block">
            <h2 className="public-experience-footer__heading">{FOOTER_CONTENT.legalHeading}</h2>
            <nav aria-label="Legal and transparency navigation">
              <ul className="public-experience-footer__nav-list">
                {FOOTER_LEGAL_LINKS.map((link) => (
                  <FooterNavItem key={`legal:${link.href ?? link.label}`} link={link} />
                ))}
              </ul>
            </nav>
          </section>
        </div>

        <p className="public-experience-footer__copyright">{FOOTER_COPYRIGHT}</p>
      </div>
    </footer>
  );
}
