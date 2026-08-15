import type { PublicCommentAuthor } from "@hu/types";

import { HumanityAvatar } from "../../../design-system/components/HumanityAvatar";

interface BlogAuthorInlineProps {
  author: PublicCommentAuthor;
}

export function BlogAuthorInline({ author }: BlogAuthorInlineProps) {
  const name = (
    <span className="blog-author-inline__name">{author.displayName}</span>
  );

  return (
    <div className="blog-author-inline">
      <HumanityAvatar avatarUrl={author.avatarUrl} alt="" size={28} />
      {author.profileUrl ? (
        <a href={author.profileUrl} className="blog-author-inline__link">
          {name}
        </a>
      ) : (
        name
      )}
    </div>
  );
}
