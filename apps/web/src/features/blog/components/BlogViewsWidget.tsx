interface BlogViewsWidgetProps {
  views: number;
}

/** Pack 14D — public-safe aggregate views of `/blog` only. */
export function BlogViewsWidget({ views }: BlogViewsWidgetProps) {
  const formatted = new Intl.NumberFormat("en").format(Math.max(0, views));

  return (
    <section className="blog-rail-widget blog-views-widget" aria-labelledby="blog-views-heading">
      <h2 id="blog-views-heading" className="hu-heading-3 blog-rail-widget__title">
        Blog Views
      </h2>
      <p className="blog-views-widget__value" aria-label={`${formatted} all-time Blog page views`}>
        {formatted}
      </p>
      <p className="hu-caption blog-views-widget__caption">
        All-time views of the Blog page (`/blog`). Aggregate only — no visitors or identities.
      </p>
    </section>
  );
}
