import type { PublicCommentAuthor } from "@hu/types";

import { HumanityAvatar } from "../../../design-system/components/HumanityAvatar";

interface BlogAuthorCardProps {
  author: PublicCommentAuthor;
}

export function BlogAuthorCard({ author }: BlogAuthorCardProps) {
  return (
    <aside className="hu-card blog-author-card" aria-label="Author">
      <HumanityAvatar avatarUrl={author.avatarUrl} alt="" size={56} />
      <div className="blog-author-card__body">
        <p className="hu-label">Author</p>
        <p className="hu-heading-3 blog-author-card__name">{author.displayName}</p>
        {author.profileUrl ? (
          <a href={author.profileUrl} className="hu-button hu-button--secondary hu-button--sm">
            View Profile
          </a>
        ) : null}
      </div>
    </aside>
  );
}
