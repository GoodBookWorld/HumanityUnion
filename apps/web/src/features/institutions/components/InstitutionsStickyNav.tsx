"use client";

import { useTranslations } from "next-intl";

import { INSTITUTIONS_STICKY_NAV_ITEMS } from "../constants";

export function InstitutionsStickyNav() {
  const t = useTranslations("institutionsPublic");

  return (
    <nav className="institutions-sticky-nav" aria-label={t("stickyNavAria")}>
      <div className="institutions-sticky-nav__inner">
        <ul className="institutions-sticky-nav__list">
          {INSTITUTIONS_STICKY_NAV_ITEMS.map((item) => (
            <li key={item.id}>
              <a href={`#${item.targetId}`} className="institutions-sticky-nav__link">
                {t(`stickyNav.${item.id}`)}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
