export type CountryAffiliationEntryType = "TEAM_MEMBER" | "PARTNER";

export interface CountryAffiliationEntry {
  entryId: string;
  countryCode: string; // ISO alpha-2 upper
  entryType: CountryAffiliationEntryType;
  name: string;
  roleOrPosition?: string | null;
  imageUrl?: string | null;
  email?: string | null; // explicit public email only
  websiteUrl?: string | null;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Public projection — no admin metadata */
export interface CountryAffiliationPublic {
  entryId: string;
  countryCode: string;
  entryType: CountryAffiliationEntryType;
  name: string;
  roleOrPosition?: string | null;
  imageUrl?: string | null;
  email?: string | null;
  websiteUrl?: string | null;
  sortOrder: number;
}
