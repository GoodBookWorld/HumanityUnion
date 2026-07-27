export const INITIATIVE_ACTIVITY_AREA_OPTIONS = [
  "Human Rights",
  "Peace and Security",
  "Democracy and Governance",
  "Justice and Rule of Law",
  "Environment and Climate",
  "Public Health",
  "Education",
  "Science and Research",
  "Technology and Digital Society",
  "Information Integrity and Media Literacy",
  "Economy and Employment",
  "Poverty Reduction and Social Protection",
  "Housing and Community Development",
  "Food and Agriculture",
  "Energy",
  "Infrastructure and Transport",
  "Culture and Heritage",
  "Equality and Inclusion",
  "Children and Youth",
  "Older Persons",
  "Disability Inclusion",
  "Migration and Integration",
  "Emergency Preparedness and Response",
  "International Cooperation",
  "Animal Welfare",
  "Other",
] as const;

export type InitiativeActivityAreaOption = (typeof INITIATIVE_ACTIVITY_AREA_OPTIONS)[number];

export const INITIATIVE_ACTIVITY_AREA_OTHER = "Other" as const;

export function isKnownInitiativeActivityArea(
  value: string,
): value is InitiativeActivityAreaOption {
  return INITIATIVE_ACTIVITY_AREA_OPTIONS.includes(value as InitiativeActivityAreaOption);
}
