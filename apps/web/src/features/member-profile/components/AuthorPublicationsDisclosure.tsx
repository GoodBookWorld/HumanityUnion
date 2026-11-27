"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type UIEvent,
} from "react";

import type { PublicAuthorPublicationCard } from "@hu/types";
import { DEFAULT_PLATFORM_LANGUAGE } from "@hu/types";

import { ApiRequestError } from "../../../lib/api-client";
import { AuthFeedbackMessage } from "../../auth/components/AuthFeedbackMessage";
import { fetchPublicAuthorPublications, formatBlogPublishedDate } from "../../blog/api";
import { buildPublicBlogPostHref } from "../../blog/blog-url";
import { resolveBlogCategoryDisplayName } from "../../blog/resolve-blog-category-display-name";
import { useHuPersistedOrdinaryFields } from "../../language/use-hu-persisted-ordinary-fields";
import { resolveMediaUrl } from "../../media-upload/media-url";
import {
  AUTHOR_PUBLICATION_PAGE_SIZE,
  authorPublicationScrollMaxPx,
  mergeAuthorPublicationCards,
  shouldLoadMoreAuthorPublications,
} from "../author-publications-list";

function AuthorPublicationCard({ post }: { post: PublicAuthorPublicationCard }) {
  const tBlog = useTranslations("blogPublic");
  const locale = useLocale();
  const persisted = useHuPersistedOrdinaryFields({
    sourceKind: "blog_post",
    sourceRecordId: post.postId,
    fallbackFields: { title: post.title },
    fieldOrder: ["title"],
  });
  const title =
    persisted.owner === "hu-persisted" &&
    persisted.presentationMode === "localized" &&
    persisted.fields.title?.trim()
      ? persisted.fields.title
      : post.title;
  const titleLang =
    persisted.owner === "hu-persisted" && persisted.presentationMode === "localized"
      ? persisted.activeLanguage
      : DEFAULT_PLATFORM_LANGUAGE;
  const coverSrc = resolveMediaUrl(post.coverImage?.mediaUrl);
  const categoryName = post.category
    ? resolveBlogCategoryDisplayName(post.category.categoryId, tBlog, post.category.name)
    : "";

  return (
    <li>
      <Link
        href={buildPublicBlogPostHref(post.slug)}
        className={
          coverSrc
            ? "public-author-publication-card"
            : "public-author-publication-card public-author-publication-card--text"
        }
        data-author-publication-card=""
      >
        {coverSrc ? (
          <img
            className="public-author-publication-card__cover"
            src={coverSrc}
            alt=""
            aria-hidden="true"
            width={160}
            height={90}
          />
        ) : null}
        <span className="public-author-publication-card__copy">
          <span className="public-author-publication-card__title" lang={titleLang}>
            {title}
          </span>
          <span className="public-author-publication-card__meta">
            {categoryName ? <span>{categoryName}</span> : null}
            {categoryName ? <span aria-hidden="true"> · </span> : null}
            <time dateTime={post.publishedAt}>
              {formatBlogPublishedDate(post.publishedAt, locale)}
            </time>
          </span>
        </span>
      </Link>
    </li>
  );
}

export function AuthorPublicationsDisclosure({ publicName }: { publicName: string }) {
  const t = useTranslations("participantPublic");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const panelId = useId();
  const subjectKey = `${publicName}\n${locale}`;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pendingRef = useRef(false);
  const generationRef = useRef(0);
  const loadedSubjectRef = useRef<string | null>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PublicAuthorPublicationCard[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [phase, setPhase] = useState<"idle" | "loading" | "ready" | "error" | "empty">("idle");
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scrollMaxPx, setScrollMaxPx] = useState<number | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => {
    return () => {
      generationRef.current += 1;
      pendingRef.current = false;
    };
  }, []);

  const loadPage = useCallback(
    async (offset: number, mode: "replace" | "append") => {
      if (pendingRef.current) {
        return;
      }
      pendingRef.current = true;
      const generation = generationRef.current;
      setErrorMessage(null);
      if (mode === "replace") {
        setPhase("loading");
      } else {
        setLoadingMore(true);
      }
      try {
        const data = await fetchPublicAuthorPublications({
          publicName,
          limit: AUTHOR_PUBLICATION_PAGE_SIZE,
          offset,
        });
        if (generation !== generationRef.current) {
          return;
        }
        setItems((current) =>
          mode === "replace" ? [...data.items] : mergeAuthorPublicationCards(current, data.items),
        );
        setHasMore(data.hasMore);
        setNextOffset(offset + data.items.length);
        loadedSubjectRef.current = subjectKey;
        setPhase(mode === "replace" && data.items.length === 0 ? "empty" : "ready");
      } catch (error) {
        if (generation !== generationRef.current) {
          return;
        }
        const unavailable =
          error instanceof ApiRequestError && (error.status === 404 || error.status === 403);
        if (unavailable && mode === "replace") {
          setItems([]);
          setHasMore(false);
          setPhase("empty");
          return;
        }
        setErrorMessage(t("authorPublications.loadError"));
        if (mode === "replace") {
          setPhase("error");
        }
      } finally {
        if (generation === generationRef.current) {
          pendingRef.current = false;
          setLoadingMore(false);
        }
      }
    },
    [publicName, subjectKey, t],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    if (loadedSubjectRef.current === subjectKey) {
      return;
    }
    if (phaseRef.current === "loading" || phaseRef.current === "error") {
      return;
    }
    void loadPage(0, "replace");
  }, [open, subjectKey, loadPage]);

  useLayoutEffect(() => {
    const root = scrollRef.current;
    if (!open || !root) {
      return;
    }
    const measure = () => {
      const cards = root.querySelectorAll<HTMLElement>("[data-author-publication-card]");
      const heights = [cards[0], cards[1]]
        .filter((card): card is HTMLElement => Boolean(card))
        .map((card) => card.getBoundingClientRect().height);
      const next = authorPublicationScrollMaxPx(heights, cards.length);
      setScrollMaxPx((current) => (current === next ? current : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [open, items.length, locale]);

  function onScroll(event: UIEvent<HTMLDivElement>) {
    const node = event.currentTarget;
    if (
      !shouldLoadMoreAuthorPublications({
        scrollTop: node.scrollTop,
        clientHeight: node.clientHeight,
        scrollHeight: node.scrollHeight,
        hasMore,
        pending: pendingRef.current,
      })
    ) {
      return;
    }
    void loadPage(nextOffset, "append");
  }

  if (phase === "empty") {
    return null;
  }

  const heading = t("sections.authorPublications");
  const pending = phase === "loading" || loadingMore;

  return (
    <section
      className="public-member-page__initiatives public-author-publications"
      aria-label={heading}
      aria-busy={pending}
    >
      <button
        type="button"
        className="hu-tab-control public-member-page__initiatives-toggle public-author-publications__toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        <img
          className="public-member-page__heading-icon"
          src="/icons/workspace/author.svg"
          alt=""
          aria-hidden="true"
          width={30}
          height={30}
        />
        <span className="public-member-page__initiatives-toggle-label">{heading}</span>
      </button>
      <div
        id={panelId}
        hidden={!open}
        className={
          open
            ? "public-member-page__initiatives-panel is-open"
            : "public-member-page__initiatives-panel"
        }
      >
        {phase === "loading" && items.length === 0 ? (
          <p className="public-author-publications__status" role="status">
            {t("authorPublications.loading")}
          </p>
        ) : null}
        {phase === "error" && items.length === 0 && errorMessage ? (
          <div className="public-author-publications__feedback">
            <AuthFeedbackMessage variant="error">{errorMessage}</AuthFeedbackMessage>
            <button type="button" className="hu-button" onClick={() => void loadPage(0, "replace")}>
              {tCommon("retry")}
            </button>
          </div>
        ) : null}
        {items.length > 0 ? (
          <div
            ref={scrollRef}
            className="public-author-publications__scroll"
            style={scrollMaxPx === null ? undefined : { maxHeight: `${scrollMaxPx}px` }}
            onScroll={onScroll}
          >
            <ul className="public-author-publications__list">
              {items.map((post) => (
                <AuthorPublicationCard key={post.postId} post={post} />
              ))}
            </ul>
            {hasMore ? (
              <button
                type="button"
                className="hu-button public-author-publications__more"
                disabled={pending}
                onClick={() => void loadPage(nextOffset, "append")}
              >
                {t("authorPublications.loadMore")}
              </button>
            ) : null}
            {loadingMore ? (
              <p className="public-author-publications__status" role="status">
                {t("authorPublications.loading")}
              </p>
            ) : null}
            {errorMessage && items.length > 0 ? (
              <div className="public-author-publications__feedback">
                <AuthFeedbackMessage variant="error">{errorMessage}</AuthFeedbackMessage>
                <button
                  type="button"
                  className="hu-button"
                  onClick={() => void loadPage(nextOffset, "append")}
                >
                  {tCommon("retry")}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
