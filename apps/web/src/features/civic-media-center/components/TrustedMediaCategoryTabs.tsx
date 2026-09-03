"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import type { TrustedMediaCategory, TrustedMediaResource } from "@hu/types";

import { HorizontalRailControls } from "../media-rail/MediaRailControls";
import { HorizontalRailViewport } from "../media-rail/MediaRailViewport";
import { useHorizontalRail } from "../media-rail/useMediaHorizontalRail";

const TRUSTED_MEDIA_TAB_STORAGE_KEY = "hu.trusted-media.active-category";

interface TrustedMediaCategoryTabsProps {
  sectionId: string;
  categories: TrustedMediaCategory[];
  resources: TrustedMediaResource[];
  renderItem: (resource: TrustedMediaResource, categoryTitle: string) => ReactNode;
}

function resolveCategoryDisplay(
  categoryId: string,
  fallback: string,
  t: {
    (key: string): string;
    has: (key: string) => boolean;
  },
  keyPrefix: "trustedCategories" | "trustedCategoryTabs",
): string {
  const key = `${keyPrefix}.${categoryId}`;
  return t.has(key) ? t(key) : fallback;
}

function TrustedMediaCategoryRail({
  sectionId,
  category,
  categoryTitle,
  resources,
  renderItem,
}: {
  sectionId: string;
  category: TrustedMediaCategory;
  categoryTitle: string;
  resources: TrustedMediaResource[];
  renderItem: (resource: TrustedMediaResource, categoryTitle: string) => ReactNode;
}) {
  const label = `${categoryTitle} media resources`;
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
          <h3>{categoryTitle}</h3>
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
        renderItem={(resource) => renderItem(resource, categoryTitle)}
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
  const t = useTranslations("civicMediaPublic");
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

  /**
   * Pack 10D — expose the active tab horizontally inside the tablist only.
   * Never call scrollIntoView on the tab (that vertically jumps `/media` under the
   * sticky header on mount / category restore).
   */
  useEffect(() => {
    if (!activeCategory) {
      return;
    }

    const tabList = document.getElementById(`${sectionId}-category-tablist`);
    const activeTab = document.getElementById(`${sectionId}-${activeCategory.id}-tab`);

    if (!(tabList instanceof HTMLElement) || !(activeTab instanceof HTMLElement)) {
      return;
    }

    const tabLeft = activeTab.offsetLeft;
    const tabRight = tabLeft + activeTab.offsetWidth;
    const viewLeft = tabList.scrollLeft;
    const viewRight = viewLeft + tabList.clientWidth;

    if (tabLeft < viewLeft) {
      tabList.scrollLeft = tabLeft;
    } else if (tabRight > viewRight) {
      tabList.scrollLeft = tabRight - tabList.clientWidth;
    }
  }, [activeCategory, sectionId]);

  if (!activeCategory) {
    return null;
  }

  const activeResources = resources.filter(
    (resource) => resource.categoryId === activeCategory.id,
  );

  function selectCategory(categoryId: string): void {
    setActiveCategoryId(categoryId);
    sessionStorage.setItem(TRUSTED_MEDIA_TAB_STORAGE_KEY, categoryId);
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    if (availableCategories.length === 0) {
      return;
    }

    let nextIndex = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      nextIndex = (index + 1) % availableCategories.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      nextIndex = (index - 1 + availableCategories.length) % availableCategories.length;
    } else if (event.key === "Home") {
      event.preventDefault();
      nextIndex = 0;
    } else if (event.key === "End") {
      event.preventDefault();
      nextIndex = availableCategories.length - 1;
    } else {
      return;
    }

    const next = availableCategories[nextIndex];
    if (next) {
      selectCategory(next.id);
      document.getElementById(`${sectionId}-${next.id}-tab`)?.focus();
    }
  }

  const activeCategoryTitle = resolveCategoryDisplay(
    activeCategory.id,
    activeCategory.title,
    t,
    "trustedCategories",
  );

  return (
    <div className="trusted-media-category-tabs">
      <div
        id={`${sectionId}-category-tablist`}
        role="tablist"
        aria-label="Trusted media categories"
        className="trusted-media-category-tabs__list"
      >
        {availableCategories.map((category, index) => {
          const isActive = category.id === activeCategory.id;
          const tabId = `${sectionId}-${category.id}-tab`;
          const tabLabel = resolveCategoryDisplay(
            category.id,
            category.title,
            t,
            "trustedCategoryTabs",
          );

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
              {tabLabel}
            </button>
          );
        })}
      </div>

      <TrustedMediaCategoryRail
        key={activeCategory.id}
        sectionId={sectionId}
        category={activeCategory}
        categoryTitle={activeCategoryTitle}
        resources={activeResources}
        renderItem={renderItem}
      />
    </div>
  );
}
