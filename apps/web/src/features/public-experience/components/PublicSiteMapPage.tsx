import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { resolveBrandForMetadata } from "../../brand-localization/resolve-brand-for-metadata";
import {
  FOOTER_LEGAL_LINKS,
  FOOTER_PLATFORM_COLUMN_ONE,
  FOOTER_PLATFORM_COLUMN_TWO,
  type FooterLink,
} from "../footer-links";
import { resolveFooterNavDisplayLabel } from "../footer-nav-i18n";

import "../public-site-map.css";

type SiteMapEntry = {
  href: string;
  label: string;
};

function activeFooterLinks(links: readonly FooterLink[]): SiteMapEntry[] {
  return links
    .filter((link): link is FooterLink & { href: string } => link.status === "active" && Boolean(link.href))
    .map((link) => ({ href: link.href, label: link.label }));
}

export async function PublicSiteMapPage() {
  const locale = await getLocale();
  const brand = await resolveBrandForMetadata(locale);
  const tNav = await getTranslations("navigation");
  const siteName = { siteName: brand.siteName };

  function labelFor(stableLabel: string): string {
    return resolveFooterNavDisplayLabel(stableLabel, tNav);
  }

  const platformEntries = [
    ...activeFooterLinks(FOOTER_PLATFORM_COLUMN_ONE),
    ...activeFooterLinks(FOOTER_PLATFORM_COLUMN_TWO),
  ];
  const legalEntries = activeFooterLinks(FOOTER_LEGAL_LINKS);

  const groups: { id: string; heading: string; entries: SiteMapEntry[] }[] = [
    {
      id: "start",
      heading: tNav("siteMapGroupStart"),
      entries: [{ href: "/", label: tNav("siteMapHome") }],
    },
    {
      id: "platform",
      heading: tNav("siteMapGroupPlatform"),
      entries: platformEntries.map((entry) => ({
        href: entry.href,
        label: labelFor(entry.label),
      })),
    },
    {
      id: "knowledge",
      heading: tNav("siteMapGroupKnowledge"),
      entries: [
        { href: "/knowledge", label: tNav("siteMapKnowledgeCenter") },
        { href: "/knowledge/media", label: tNav("siteMapKnowledgeMedia") },
        { href: "/civic-activity", label: tNav("siteMapCivicActivity") },
      ],
    },
    {
      id: "legal",
      heading: tNav("siteMapGroupLegal"),
      entries: legalEntries.map((entry) => ({
        href: entry.href,
        label: labelFor(entry.label),
      })),
    },
  ];

  return (
    <article className="public-site-map">
      <h1>{tNav("siteMapPageTitle")}</h1>
      <p className="public-site-map__intro">{tNav("siteMapPageIntro", siteName)}</p>

      <div className="public-site-map__groups">
        {groups.map((group) => (
          <section key={group.id} className="public-site-map__group" aria-labelledby={`site-map-${group.id}`}>
            <h2 id={`site-map-${group.id}`}>{group.heading}</h2>
            <ul className="public-site-map__list">
              {group.entries.map((entry) => (
                <li key={entry.href}>
                  <Link href={entry.href}>{entry.label}</Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </article>
  );
}
