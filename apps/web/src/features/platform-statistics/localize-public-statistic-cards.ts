/**
 * Pack 08I.5 — shared localized statistics vocabulary for Home + Geo surfaces.
 * Numeric values stay canonical; labels/descriptions/chrome come from catalogs.
 */

import type { PublicStatisticCardConfig } from "./public-statistics-config";

type MetricTranslator = {
  (key: string): string;
};

/**
 * Overlay catalog metric/card strings onto config seeds.
 * `labelKey` / `descriptionKey` are next-intl message keys relative to the translator namespace.
 */
export function localizePublicStatisticCards<T extends PublicStatisticCardConfig>(
  cards: ReadonlyArray<T>,
  t: MetricTranslator,
  options: {
    readonly labelPath: (key: string) => string;
    readonly descriptionPath: (key: string) => string;
  },
): T[] {
  return cards.map((card) => ({
    ...card,
    label: t(options.labelPath(card.key)),
    description: t(options.descriptionPath(card.key)),
  }));
}
