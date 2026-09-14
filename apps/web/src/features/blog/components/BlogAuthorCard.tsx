import { useTranslations } from "next-intl";

import type { PublicCommentAuthor } from "@hu/types";

import { HumanityAvatar } from "../../../design-system/components/HumanityAvatar";

interface BlogAuthorCardProps {
  author: PublicCommentAuthor;
}

export function BlogAuthorCard({ author }: BlogAuthorCardProps) {
  const t = useTranslations("blogPublic.discovery.authorCard");

  return (
    <aside className="hu-card blog-author-card" aria-label={t("ariaLabel")}>
      <HumanityAvatar avatarUrl={author.avatarUrl} alt="" size={56} />
      <div className="blog-author-card__body">
        <p className="hu-label">{t("label")}</p>
        <p className="hu-heading-3 blog-author-card__name">{author.displayName}</p>
        {author.profileUrl ? (
          <a href={author.profileUrl} className="hu-button hu-button--secondary hu-button--sm">
            {t("viewProfile")}
          </a>
        ) : null}
      </div>
    </aside>
  );
}
