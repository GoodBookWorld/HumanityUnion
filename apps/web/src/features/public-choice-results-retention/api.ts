import { API_BASE_URL } from "../../lib/api-base-url";

/**
 * Pack 02C — download temporary Final Results PDF during retention window.
 * Server enforces closedAt + 72h policy independently of UI.
 */
export async function downloadPublicChoiceResultsPdf(
  initiativeId: string,
  decisionId?: string,
): Promise<void> {
  const params = new URLSearchParams();
  if (decisionId) {
    params.set("decisionId", decisionId);
  }
  const query = params.toString();
  const url = `${API_BASE_URL}/api/v1/initiatives/${encodeURIComponent(initiativeId)}/public-choice-results/download${
    query ? `?${query}` : ""
  }`;

  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    let message = "Results download failed.";
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) {
        message = body.message;
      }
    } catch {
      // keep default
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = `humanity-union-public-choice-results-${initiativeId}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
