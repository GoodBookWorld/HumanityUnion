import type { Document } from "mongodb";

import type { MediaResource } from "@hu/types";

export interface MediaResourceMongoDocument extends Document {
  id: string;
  resourceType: MediaResource["resourceType"];
  scopeType: MediaResource["scopeType"];
  countryCode: string | null;
  name: string;
  logoLabel: string;
  logoUrl?: string | null;
  websiteUrl: string;
  rssUrl?: string | null;
  categoryId?: string | null;
  description?: string | null;
  secondaryText?: string | null;
  language?: string | null;
  providerId?: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export function toMediaResourceMongoDocument(
  resource: MediaResource,
): MediaResourceMongoDocument {
  return {
    id: resource.id,
    resourceType: resource.resourceType,
    scopeType: resource.scopeType,
    countryCode: resource.countryCode,
    name: resource.name,
    logoLabel: resource.logoLabel,
    logoUrl: resource.logoUrl ?? null,
    websiteUrl: resource.websiteUrl,
    rssUrl: resource.rssUrl ?? null,
    categoryId: resource.categoryId ?? null,
    description: resource.description ?? null,
    secondaryText: resource.secondaryText ?? null,
    language: resource.language ?? null,
    providerId: resource.providerId ?? null,
    active: resource.active,
    sortOrder: resource.sortOrder,
    createdAt: resource.createdAt,
    updatedAt: resource.updatedAt,
  };
}

export function fromMediaResourceMongoDocument(
  document: MediaResourceMongoDocument,
): MediaResource {
  return {
    id: document.id,
    resourceType: document.resourceType,
    scopeType: document.scopeType,
    countryCode: document.countryCode ?? null,
    name: document.name,
    logoLabel: document.logoLabel,
    logoUrl: document.logoUrl ?? null,
    websiteUrl: document.websiteUrl,
    rssUrl: document.rssUrl ?? null,
    categoryId: document.categoryId ?? null,
    description: document.description ?? null,
    secondaryText: document.secondaryText ?? null,
    language: document.language ?? null,
    providerId: document.providerId ?? null,
    active: document.active,
    sortOrder: document.sortOrder,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}
