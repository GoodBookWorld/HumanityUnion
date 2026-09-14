import { useLocale, useTranslations } from "next-intl";

interface BlogViewsWidgetProps {
  views: number;
}

/** Pack 14D — public-safe aggregate views of `/blog` only. */
export function BlogViewsWidget({ views }: BlogViewsWidgetProps) {
  const t = useTranslations("blogPublic.discovery.views");
  const locale = useLocale();
  const count = Math.max(0, views);
  const formatted = new Intl.NumberFormat(locale).format(count);

  return (
    <section className="blog-rail-widget blog-views-widget" aria-labelledby="blog-views-heading">
      <h2 id="blog-views-heading" className="hu-heading-3 blog-rail-widget__title">
        {t("heading")}
      </h2>
      <p className="blog-views-widget__value" aria-label={t("valueAria", { count: formatted })}>
        {formatted}
      </p>
      <p className="hu-caption blog-views-widget__caption">{t("caption")}</p>
    </section>
  );
}
