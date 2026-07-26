import type { Member, MemberRole, MemberStatus, VerificationLevel } from "@hu/types";
import type { Document } from "mongodb";

import type { CreatePersistedMemberInput, PersistedMemberRecord } from "../domain/member.types.js";

export interface MemberMongoDocument extends Document {
  memberId: string;
  identityId: string;
  displayName: string;
  uniqueName: string;
  country?: string;
  region?: string;
  city?: string;
  languages: string[];
  status: MemberStatus;
  verificationLevel: VerificationLevel;
  roles: MemberRole[];
  registrationStatus: PersistedMemberRecord["registrationStatus"];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export function toMemberMongoDocument(record: PersistedMemberRecord): MemberMongoDocument {
  return {
    memberId: record.memberId,
    identityId: record.identityId,
    displayName: record.displayName,
    uniqueName: record.uniqueName,
    country: record.country,
    region: record.region,
    city: record.city,
    languages: [...record.languages],
    status: record.status,
    verificationLevel: record.verificationLevel,
    roles: [...record.roles],
    registrationStatus: record.registrationStatus,
    version: record.version,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function fromMemberMongoDocument(document: MemberMongoDocument): PersistedMemberRecord {
  return {
    memberId: document.memberId,
    identityId: document.identityId,
    displayName: document.displayName,
    uniqueName: document.uniqueName,
    country: document.country,
    region: document.region,
    city: document.city,
    languages: document.languages?.length ? [...document.languages] : ["en"],
    status: document.status,
    verificationLevel: document.verificationLevel,
    roles: [...document.roles],
    registrationStatus: document.registrationStatus,
    version: document.version,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

export function buildNewPersistedMember(input: CreatePersistedMemberInput): PersistedMemberRecord {
  const timestamp = new Date().toISOString();

  return {
    memberId: input.memberId,
    identityId: input.identityId,
    displayName: input.displayName.trim(),
    uniqueName: input.uniqueName,
    languages: ["en"],
    status: "active",
    verificationLevel: input.verificationLevel ?? "email",
    roles: ["member"],
    registrationStatus: "registered",
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function toMemberDomain(record: PersistedMemberRecord): Member {
  return {
    id: record.memberId,
    profile: {
      displayName: record.displayName,
      uniqueName: record.uniqueName,
      ...(record.country ? { country: record.country } : {}),
      ...(record.region ? { region: record.region } : {}),
      ...(record.city ? { city: record.city } : {}),
      languages: [...record.languages],
    },
    status: record.status,
    verificationLevel: record.verificationLevel,
    roles: record.roles,
    fair: {
      personal: 0,
      community: 0,
      regional: 0,
      global: 0,
    },
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
