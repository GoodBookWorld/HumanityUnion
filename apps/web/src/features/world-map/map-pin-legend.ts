/**
 * Step 15D.3.1 — HU map pin legend identity + WEB_UI ownership contract.
 *
 * Active legend pins are localized via publicHome.interactiveMap.legend.*.
 * Geometry/colors/URLs stay in pins-config.js keyed by stable legendId.
 */

export type MapPinLegendId =
  | "presidential_republics"
  | "semi_presidential_republic"
  | "executive_president_republic"
  | "parliamentary_constitutional_monarchies"
  | "parliamentary_republics"
  | "parliamentary_constitutional_monarchy"
  | "absolute_monarchies"
  | "military_junta"
  | "one_party_state"
  | "provisional_government";

export type MapPinLegendMessageKey =
  | "presidentialRepublics"
  | "semiPresidentialRepublic"
  | "executivePresidentRepublic"
  | "parliamentaryConstitutionalMonarchies"
  | "parliamentaryRepublics"
  | "parliamentaryConstitutionalMonarchy"
  | "absoluteMonarchies"
  | "militaryJunta"
  | "onePartyState"
  | "provisionalGovernment";

export type MapPinLegendEntry = {
  readonly id: MapPinLegendId;
  /** Leaf under publicHome.interactiveMap.legend.* */
  readonly messageKey: MapPinLegendMessageKey;
};

/** Stable active-pin catalog — order matches active square pins in pins-config.js. */
export const MAP_PIN_LEGEND_ENTRIES: readonly MapPinLegendEntry[] = [
  { id: "presidential_republics", messageKey: "presidentialRepublics" },
  { id: "semi_presidential_republic", messageKey: "semiPresidentialRepublic" },
  { id: "executive_president_republic", messageKey: "executivePresidentRepublic" },
  {
    id: "parliamentary_constitutional_monarchies",
    messageKey: "parliamentaryConstitutionalMonarchies",
  },
  { id: "parliamentary_republics", messageKey: "parliamentaryRepublics" },
  {
    id: "parliamentary_constitutional_monarchy",
    messageKey: "parliamentaryConstitutionalMonarchy",
  },
  { id: "absolute_monarchies", messageKey: "absoluteMonarchies" },
  { id: "military_junta", messageKey: "militaryJunta" },
  { id: "one_party_state", messageKey: "onePartyState" },
  { id: "provisional_government", messageKey: "provisionalGovernment" },
] as const;

export const MAP_PIN_LEGEND_IDS: readonly MapPinLegendId[] = MAP_PIN_LEGEND_ENTRIES.map(
  (entry) => entry.id,
);

export type MapPinLegendLabel = {
  readonly title: string;
  readonly description: string;
};

export type MapPinLegendLabelsById = Readonly<Record<string, MapPinLegendLabel>>;

/** Dot paths under the English WEB_UI catalog (title + description per pin). */
export function mapPinLegendWebUiPaths(): readonly string[] {
  const paths: string[] = [];
  for (const entry of MAP_PIN_LEGEND_ENTRIES) {
    paths.push(`publicHome.interactiveMap.legend.${entry.messageKey}.title`);
    paths.push(`publicHome.interactiveMap.legend.${entry.messageKey}.description`);
  }
  return paths;
}
