interface PublicNewsPaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

function buildVisiblePages(page: number, totalPages: number): number[] {
  const pages = new Set<number>([1, totalPages, page, page - 1, page + 1]);
  return [...pages].filter((value) => value >= 1 && value <= totalPages).sort((a, b) => a - b);
}

export function PublicNewsPagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: PublicNewsPaginationProps) {
  if (totalPages <= 1) {
    return (
      <p className="public-news-pagination__info">
        Showing {totalItems} article{totalItems === 1 ? "" : "s"}
      </p>
    );
  }

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  const visiblePages = buildVisiblePages(page, totalPages);

  return (
    <nav className="public-news-pagination" aria-label="News discovery pagination">
      <p className="public-news-pagination__info">
        Showing {start}–{end} of {totalItems} articles
      </p>
      <div className="public-news-pagination__controls">
        <button
          type="button"
          className="public-news-pagination__button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          Previous
        </button>
        {visiblePages.map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            className="public-news-pagination__page"
            onClick={() => onPageChange(pageNumber)}
            aria-label={`Page ${pageNumber}`}
            aria-current={pageNumber === page ? "page" : undefined}
          >
            {pageNumber}
          </button>
        ))}
        <button
          type="button"
          className="public-news-pagination__button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          Next
        </button>
      </div>
    </nav>
  );
}
