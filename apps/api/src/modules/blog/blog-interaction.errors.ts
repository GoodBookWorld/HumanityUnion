export class BlogCommentValidationError extends Error {
  readonly code = "blog_comment_validation" as const;

  constructor(message: string) {
    super(message);
    this.name = "BlogCommentValidationError";
  }
}

export class BlogCommentAccessDeniedError extends Error {
  readonly code = "blog_comment_access_denied" as const;

  constructor(message = "You do not have permission to perform this comment action.") {
    super(message);
    this.name = "BlogCommentAccessDeniedError";
  }
}

export class BlogCommentNotFoundError extends Error {
  readonly code = "blog_comment_not_found" as const;

  constructor(message = "Comment not found.") {
    super(message);
    this.name = "BlogCommentNotFoundError";
  }
}

export class BlogCommentConflictError extends Error {
  readonly code = "blog_comment_conflict" as const;

  constructor(message: string) {
    super(message);
    this.name = "BlogCommentConflictError";
  }
}

export class BlogCommentRateLimitError extends Error {
  readonly code = "blog_comment_rate_limit" as const;

  constructor(message = "Please wait before posting another comment.") {
    super(message);
    this.name = "BlogCommentRateLimitError";
  }
}

export class BlogReactionRateLimitError extends Error {
  readonly code = "blog_reaction_rate_limit" as const;

  constructor(message = "Please wait before reacting again.") {
    super(message);
    this.name = "BlogReactionRateLimitError";
  }
}
