"use client";

import type { PublicNewsArticleItem } from "@hu/types";

import { useMediaHorizontalRail } from "../../civic-media-center/media-rail";
import { MediaRailControls } from "../../civic-media-center/media-rail/MediaRailControls";
import { PublicNewsCard } from "./PublicNewsCard";

import "../../civic-media-center/media-rail/media-rail.css";

interface PublicNewsRailProps {
  articles: PublicNewsArticleItem[];
  label?: string;
}

export function PublicNewsRail({
  articles,
  label = "Trusted news discovery results",
}: PublicNewsRailProps) {
  const rail = useMediaHorizontalRail({
    itemCount: articles.length,
    layout: "three-two-one",
    label,
  });

  if (articles.length === 0) {
    return null;
  }

  return (
    <div
      className="media-horizontal-rail public-news-rail"
      aria-roledescription="carousel"
      aria-label={label}
      data-visible-count={rail.visibleCount}
      data-layout="three-two-one"
    >
      <p id={rail.instructionsId} className="media-rail__visually-hidden">
        {label}. Use the previous and next buttons, arrow keys, or horizontal scrolling to browse
        additional news cards.
      </p>

      <div className="public-news-rail__toolbar">
        <MediaRailControls
          label="news cards"
          canScrollPrevious={rail.canScrollPrevious}
          canScrollNext={rail.canScrollNext}
          onPrevious={rail.showPrevious}
          onNext={rail.showNext}
        />
      </div>

      <div
        className={`media-horizontal-rail__frame${
          rail.canScrollPrevious ? " media-horizontal-rail__frame--fade-start" : ""
        }${rail.canScrollNext ? " media-horizontal-rail__frame--fade-end" : ""}`}
      >
        <div
          ref={rail.viewportRef}
          className="media-horizontal-rail__viewport public-news-rail__viewport"
          role="list"
          aria-live="polite"
          aria-describedby={rail.instructionsId}
          tabIndex={0}
          onKeyDown={rail.handleKeyDown}
          onScroll={rail.handleScroll}
        >
          {articles.map((article, index) => (
            <div
              key={article.id}
              className="media-horizontal-rail__slide public-news-rail__slide"
              role="listitem"
              data-media-rail-index={index}
            >
              <PublicNewsCard article={article} />
            </div>
          ))}
        </div>
      </div>

      <p className="media-horizontal-rail__summary" aria-live="polite">
        Showing {rail.startIndex + 1}–{rail.visibleEnd} of {articles.length} trusted article
        {articles.length === 1 ? "" : "s"}
      </p>
    </div>
  );
}
