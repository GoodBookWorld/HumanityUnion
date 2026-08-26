import type { PublicBlogSubscribeResponse } from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export async function requestPublicBlogSubscription(
  email: string,
): Promise<PublicBlogSubscribeResponse> {
  return apiRequest<PublicBlogSubscribeResponse>("/api/v1/public/blog/subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

export async function confirmPublicBlogSubscription(token: string): Promise<{
  confirmed: true;
  message: string;
}> {
  return apiRequest<{ confirmed: true; message: string }>(
    "/api/v1/public/blog/subscriptions/confirm",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    },
  );
}

export async function unsubscribePublicBlogSubscription(token: string): Promise<{
  unsubscribed: true;
  message: string;
}> {
  return apiRequest<{ unsubscribed: true; message: string }>(
    "/api/v1/public/blog/subscriptions/unsubscribe",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    },
  );
}
