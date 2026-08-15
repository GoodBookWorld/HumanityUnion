import type { BlogAuthorApplication, BlogAuthoringAccessState } from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export interface SubmitBlogAuthorApplicationInput {
  motivation: string;
  topics: string;
  previousWritingUrl?: string;
  preferredCategoryIds: readonly string[];
  agreedToStandards: true;
}

export async function fetchBlogAuthoringAccessState(): Promise<BlogAuthoringAccessState> {
  return apiRequest<BlogAuthoringAccessState>("/api/v1/blog/authoring");
}

export async function submitBlogAuthorApplication(
  input: SubmitBlogAuthorApplicationInput,
): Promise<BlogAuthorApplication> {
  return apiRequest<BlogAuthorApplication>("/api/v1/blog/author-applications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function resubmitBlogAuthorApplication(
  applicationId: string,
  input: SubmitBlogAuthorApplicationInput,
): Promise<BlogAuthorApplication> {
  return apiRequest<BlogAuthorApplication>(
    `/api/v1/blog/author-applications/${encodeURIComponent(applicationId)}/resubmit`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}
