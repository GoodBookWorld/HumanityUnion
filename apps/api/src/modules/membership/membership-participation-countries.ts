import type { MembershipRecord } from "@hu/types";

export function resolveMembershipParticipationCountryCodes(
  record: Pick<MembershipRecord, "participationCountryCodes" | "countryCode">,
): string[] {
  if (
    Array.isArray(record.participationCountryCodes) &&
    record.participationCountryCodes.length > 0
  ) {
    return record.participationCountryCodes;
  }

  if (record.countryCode) {
    return [record.countryCode];
  }

  return [];
}

export function normalizeMembershipRecordCountries(record: MembershipRecord): MembershipRecord {
  const participationCountryCodes = resolveMembershipParticipationCountryCodes(record);

  return {
    ...record,
    participationCountryCodes:
      participationCountryCodes.length > 0 ? participationCountryCodes : null,
    countryCode: participationCountryCodes[0] ?? record.countryCode ?? null,
  };
}
