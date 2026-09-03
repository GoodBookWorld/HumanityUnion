import { getTranslations } from "next-intl/server";

export default async function BlogLoading() {
  const t = await getTranslations("blogPublic");

  return (
    <main className="blog-page hu-page-container">
      <p className="blog-page__status">{t("loadingPublications")}</p>
    </main>
  );
}
