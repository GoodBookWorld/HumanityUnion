import Link from "next/link";

import { buildBlogIndexHref } from "../blog-url";

interface BlogPaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  q: string;
  categorySlug: string;
}

function buildVisiblePages(page: number, totalPages: number): number[] {
  const pages = new Set<number>([1, totalPages, page, page - 1, page + 1]);
  return [...pages].filter((value) => value >= 1 && value <= totalPages).sort((a, b) => a - b);
}

export function BlogPagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  q,
  categorySlug,
}: BlogPaginationProps) {
  if (totalItems === 0) {
    return null;
  }

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  if (totalPages <= 1) {
    return (
      <p className="blog-pagination__info">
        Showing {totalItems} publication{totalItems === 1 ? "" : "s"}
      </p>
    );
  }

  const visiblePages = buildVisiblePages(page, totalPages);

  return (
    <nav className="blog-pagination" aria-label="Blog pagination">
      <p className="blog-pagination__info">
        Showing {start}–{end} of {totalItems} publications
      </p>
      <div className="blog-pagination__controls">
        {page > 1 ? (
          <Link
            href={buildBlogIndexHref({ q, categorySlug, page: page - 1 })}
            className="hu-button hu-button--secondary hu-button--sm"
            rel="prev"
          >
            Previous
          </Link>
        ) : (
          <span className="hu-button hu-button--secondary hu-button--sm" aria-disabled="true">
            Previous
          </span>
        )}
        {visiblePages.map((pageNumber) => (
          <Link
            key={pageNumber}
            href={buildBlogIndexHref({ q, categorySlug, page: pageNumber })}
            className={
              pageNumber === page
                ? "blog-pagination__page blog-pagination__page--current"
                : "blog-pagination__page"
            }
            aria-label={`Page ${pageNumber}`}
            aria-current={pageNumber === page ? "page" : undefined}
          >
            {pageNumber}
          </Link>
        ))}
        {page < totalPages ? (
          <Link
            href={buildBlogIndexHref({ q, categorySlug, page: page + 1 })}
            className="hu-button hu-button--secondary hu-button--sm"
            rel="next"
          >
            Next
          </Link>
        ) : (
          <span className="hu-button hu-button--secondary hu-button--sm" aria-disabled="true">
            Next
          </span>
        )}
      </div>
    </nav>
  );
}
