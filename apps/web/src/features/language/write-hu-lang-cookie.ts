/**
 * Client helper — write canonical `hu_lang` via Web-origin route (validated).
 */

export interface WriteHuLangCookieResult {
  readonly locale: string;
  readonly languageId: string;
  readonly textDirection: "ltr" | "rtl";
}

export async function writeHuLangCookieViaWebRoute(
  locale: string,
): Promise<WriteHuLangCookieResult> {
  const response = await fetch("/api/hu-lang", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ locale }),
    credentials: "same-origin",
  });

  const envelope = (await response.json()) as {
    success?: boolean;
    message?: string;
    data?: WriteHuLangCookieResult;
  };

  if (!response.ok || !envelope.success || !envelope.data) {
    throw new Error(envelope.message ?? "Unable to save language preference.");
  }

  return envelope.data;
}
