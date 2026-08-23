import type { PublicCommentAuthor } from "@hu/types";

import { HumanityAvatar } from "../../../design-system/components/HumanityAvatar";

interface BlogAuthorInlineProps {
  author: PublicCommentAuthor;
}

export function BlogAuthorInline({ author }: BlogAuthorInlineProps) {
  const identity = (
    <>
      <HumanityAvatar avatarUrl={author.avatarUrl} alt="" size={28} />
      <span className="blog-author-inline__name">{author.displayName}</span>
    </>
  );

  if (author.profileUrl) {
    return (
      <a href={author.profileUrl} className="blog-author-inline blog-author-inline__link">
        {identity}
      </a>
    );
  }

  return <div className="blog-author-inline">{identity}</div>;
}
