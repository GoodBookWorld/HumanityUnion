"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import type { TrustedMediaCategory, TrustedMediaResource } from "@hu/types";

import { HorizontalRailControls } from "../media-rail/MediaRailControls";
import { HorizontalRailViewport } from "../media-rail/MediaRailViewport";
import { useHorizontalRail } from "../media-rail/useMediaHorizontalRail";

const TRUSTED_MEDIA_TAB_STORAGE_KEY = "hu.trusted-media.active-category";

const TRUSTED_MEDIA_TAB_LABELS: Record<string, string> = {
  "international-wire-service": "Wire Services",
  "public-broadcaster": "Public Broadcasters",
  "independent-investigative": "Investigative",
  "regional-public-media": "Regional Media",
  "scientific-publisher": "Scientific Publishers",
  "academic-resource": "Academic Resources",
};

interface TrustedMediaCategoryTabsProps {
  sectionId: string;
  categories: TrustedMediaCategory[];
  resources: TrustedMediaResource[];
  renderItem: (resource: TrustedMediaResource, categoryTitle: string) => ReactNode;
}

function TrustedMediaCategoryRail({
  sectionId,
  category,
  resources,
  renderItem,
}: {
  sectionId: string;
  category: TrustedMediaCategory;
  resources: TrustedMediaResource[];
  renderItem: (resource: TrustedMediaResource, categoryTitle: string) => ReactNode;
}) {
  const label = `${category.title} media resources`;
  const rail = useHorizontalRail({
    itemCount: resources.length,
    layout: "four-two-one",
    label,
  });

  const controls =
    resources.length > 0 && !rail.allItemsVisible ? (
      <HorizontalRailControls
        label={label}
        canScrollPrevious={rail.canScrollPrevious}
        canScrollNext={rail.canScrollNext}
        onPrevious={rail.showPrevious}
        onNext={rail.showNext}
        compact
      />
    ) : null;

  return (
    <div
      id={`${sectionId}-${category.id}-panel`}
      role="tabpanel"
      aria-labelledby={`${sectionId}-${category.id}-tab`}
      className="trusted-media-category-tabs__panel"
    >
      <div className="trusted-media-category-tabs__panel-heading">
        <div>
          <h3>{category.title}</h3>
          <span className="horizontal-section-chip">
            {resources.length} source{resources.length === 1 ? "" : "s"}
          </span>
        </div>
        {controls}
      </div>
      <p className="trusted-media-category-tabs__panel-description">{category.description}</p>

      <HorizontalRailViewport
        label={label}
        layout="four-two-one"
        items={resources}
        getItemKey={(resource) => resource.id}
        renderItem={(resource) => renderItem(resource, category.title)}
        rail={rail}
        hideSummary
      />
    </div>
  );
}

export function TrustedMediaCategoryTabs({
  sectionId,
  categories,
  resources,
  renderItem,
}: TrustedMediaCategoryTabsProps) {
  const availableCategories = useMemo(
    () =>
      categories.filter((category) =>
        resources.some((resource) => resource.categoryId === category.id),
      ),
    [categories, resources],
  );

  const [activeCategoryId, setActiveCategoryId] = useState(
    () => availableCategories[0]?.id ?? "",
  );

  useEffect(() => {
    if (availableCategories.length === 0) {
      return;
    }

    const storedCategoryId = sessionStorage.getItem(TRUSTED_MEDIA_TAB_STORAGE_KEY);
    const resolvedCategoryId = availableCategories.some(
      (category) => category.id === storedCategoryId,
    )
      ? storedCategoryId
      : availableCategories[0]?.id;

    if (resolvedCategoryId) {
      setActiveCategoryId(resolvedCategoryId);
    }
  }, [availableCategories]);

  const activeCategory =
    availableCategories.find((category) => category.id === activeCategoryId) ??
    availableCategories[0];

  const activeResources = useMemo(
    () =>
      activeCategory
        ? resources.filter((resource) => resource.categoryId === activeCategory.id)
        : [],
    [activeCategory, resources],
  );

  if (!activeCategory) {
    return null;
  }

  function selectCategory(categoryId: string) {
    setActiveCategoryId(categoryId);
    sessionStorage.setItem(TRUSTED_MEDIA_TAB_STORAGE_KEY, categoryId);
  }

  function handleTabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
      return;
    }

    event.preventDefault();

    const direction = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (index + direction + availableCategories.length) % availableCategories.length;
    const nextCategory = availableCategories[nextIndex];

    if (nextCategory) {
      selectCategory(nextCategory.id);
      document.getElementById(`${sectionId}-${nextCategory.id}-tab`)?.focus();
    }
  }

  return (
    <div className="trusted-media-category-tabs">
      <div
        role="tablist"
        aria-label="Trusted media categories"
        className="trusted-media-category-tabs__list"
      >
        {availableCategories.map((category, index) => {
          const isActive = category.id === activeCategory.id;
          const tabId = `${sectionId}-${category.id}-tab`;

          return (
            <button
              key={category.id}
              id={tabId}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`${sectionId}-${category.id}-panel`}
              tabIndex={isActive ? 0 : -1}
              className="trusted-media-category-tabs__tab"
              onClick={() => selectCategory(category.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
            >
              {TRUSTED_MEDIA_TAB_LABELS[category.id] ?? category.title}
            </button>
          );
        })}
      </div>

      <TrustedMediaCategoryRail
        key={activeCategory.id}
        sectionId={sectionId}
        category={activeCategory}
        resources={activeResources}
        renderItem={renderItem}
      />
    </div>
  );
}
