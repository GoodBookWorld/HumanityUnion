import Link from "next/link";

import { FOOTER_CONTENT } from "../content";
import type { FooterLink } from "../footer-links";
import { FOOTER_LEGAL_LINKS, FOOTER_PLATFORM_LINKS } from "../footer-links";

function FooterNavItem({ link }: { link: FooterLink }) {
  if (link.status === "active" && link.href) {
    return (
      <li>
        <Link href={link.href}>{link.label}</Link>
      </li>
    );
  }

  return (
    <li>
      <span
        className="public-experience-footer__placeholder"
        aria-disabled="true"
        title={`${link.label} — coming soon`}
      >
        {link.label}
        <span className="public-experience-footer__placeholder-note"> (coming soon)</span>
      </span>
    </li>
  );
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
        <p className="public-experience-footer__identity">{FOOTER_CONTENT.identity}</p>
        <p className="public-experience-footer__context">{FOOTER_CONTENT.contextIntroduction}</p>

        <div className="public-experience-footer__groups">
          <nav
            className="public-experience-footer__nav"
            aria-label="Platform supporting navigation"
          >
            <h3 className="public-experience-footer__heading">{FOOTER_CONTENT.platformHeading}</h3>
            <ul className="public-experience-footer__nav-list">
              {FOOTER_PLATFORM_LINKS.map((link) => (
                <FooterNavItem key={link.label} link={link} />
              ))}
            </ul>
          </nav>

          <nav
            className="public-experience-footer__nav"
            aria-label="Legal and transparency navigation"
          >
            <h3 className="public-experience-footer__heading">{FOOTER_CONTENT.legalHeading}</h3>
            <ul className="public-experience-footer__nav-list">
              {FOOTER_LEGAL_LINKS.map((link) => (
                <FooterNavItem key={link.label} link={link} />
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
