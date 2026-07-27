"use client";

import type { ReactNode } from "react";

import { HuxDiscoverySection } from "../../horizontal-experience";
import type { HorizontalRailLayout } from "../../civic-media-center/media-rail/horizontal-section.types";

export type HomeCollectionLayoutPreset = HorizontalRailLayout | "default";

interface PublicHomeHorizontalCollectionProps<T> {
  label: string;
  items: T[];
  emptyState?: ReactNode;
  renderItem: (item: T, index: number) => ReactNode;
  getItemKey: (item: T, index: number) => string;
  layout?: HomeCollectionLayoutPreset;
  footerAction?: ReactNode;
  sectionId?: string;
  title?: string;
  description?: string;
  eyebrow?: string;
  headerAction?: ReactNode;
}

function resolveLayout(layout: HomeCollectionLayoutPreset): HorizontalRailLayout {
  return layout === "default" ? "three-two-one" : layout;
}

/** @deprecated Use HuxDiscoverySection directly */
export function PublicHomeHorizontalCollection<T>({
  label,
  items,
  emptyState,
  renderItem,
  getItemKey,
  layout = "three-two-one",
  footerAction,
  sectionId = "public-home-collection",
  title,
  description,
  eyebrow,
  headerAction,
}: PublicHomeHorizontalCollectionProps<T>) {
  return (
    <HuxDiscoverySection
      sectionId={sectionId}
      eyebrow={eyebrow}
      title={title ?? label}
      description={description}
      label={label}
      items={items}
      layout={resolveLayout(layout)}
      emptyState={emptyState}
      headerAction={headerAction}
      footerAction={footerAction}
      getItemKey={getItemKey}
      renderItem={renderItem}
    />
  );
}

/** @deprecated Use PublicHomeHorizontalCollection */
export const PublicHomeCarousel = PublicHomeHorizontalCollection;

export type CarouselLayoutPreset = HomeCollectionLayoutPreset;
