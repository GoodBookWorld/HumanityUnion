"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { buildBlogIndexHref } from "../blog-url";

interface BlogDiscoverySearchProps {
  activeCategorySlug?: string;
  q?: string;
  searchInputId?: string;
}

/** Pack 15C — canonical Blog search (spans center + right on desktop). */
export function BlogDiscoverySearch({
  activeCategorySlug = "all",
  q = "",
  searchInputId = "blog-search",
}: BlogDiscoverySearchProps) {
  const t = useTranslations("blogPublic.search");
  const router = useRouter();
  const [draftQuery, setDraftQuery] = useState(q);

  useEffect(() => {
    setDraftQuery(q);
  }, [q]);

  function onSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(buildBlogIndexHref({ q: draftQuery, categorySlug: activeCategorySlug, page: 1 }));
  }

  return (
    <form className="blog-filters blog-layout__search" onSubmit={onSearchSubmit} role="search">
      <div className="blog-filters__search">
        <label className="hu-label" htmlFor={searchInputId}>
          {t("label")}
        </label>
        <div className="blog-filters__search-row">
          <input
            id={searchInputId}
            name="q"
            type="search"
            className="hu-form-control"
            value={draftQuery}
            onChange={(event) => setDraftQuery(event.target.value)}
            placeholder={t("placeholder")}
            autoComplete="off"
          />
          <button type="submit" className="hu-button hu-button--primary">
            {t("submit")}
          </button>
        </div>
      </div>
    </form>
  );
}
