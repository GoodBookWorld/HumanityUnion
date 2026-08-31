/**
 * Production Completion Pack 02C Task 03 — Web-origin `hu_lang` write API.
 *
 * Validates against enabled Registry (public languages), stores canonical locale only.
 */

import { NextResponse } from "next/server";

import { canonicalizeEnabledLocale } from "../../../features/language/canonicalize-locale";
import { buildWebHuLangCookieAttributes } from "../../../features/language/hu-lang-cookie.web";
import { loadEnabledPublicLocaleCatalog } from "../../../features/language/public-languages-api";

interface HuLangWriteBody {
  readonly locale?: unknown;
}

export async function POST(request: Request): Promise<Response> {
  let body: HuLangWriteBody;
  try {
    body = (await request.json()) as HuLangWriteBody;
  } catch {
    return NextResponse.json(
      { success: false, message: "Request body must be JSON." },
      { status: 400 },
    );
  }

  const requested =
    typeof body.locale === "string" ? body.locale.trim() : "";
  if (!requested) {
    return NextResponse.json(
      { success: false, message: "locale is required." },
      { status: 400 },
    );
  }

  let catalog;
  try {
    catalog = await loadEnabledPublicLocaleCatalog();
  } catch {
    return NextResponse.json(
      { success: false, message: "Language registry is temporarily unavailable." },
      { status: 503 },
    );
  }

  const resolved = canonicalizeEnabledLocale(requested, catalog);
  if (!resolved) {
    return NextResponse.json(
      { success: false, message: "locale must be an enabled platform language." },
      { status: 400 },
    );
  }

  const attributes = buildWebHuLangCookieAttributes();
  const response = NextResponse.json({
    success: true,
    data: {
      locale: resolved.locale,
      languageId: resolved.languageId,
      textDirection: resolved.textDirection,
    },
    message: "Language preference cookie updated.",
  });

  response.cookies.set({
    name: attributes.name,
    value: resolved.locale,
    path: attributes.path,
    sameSite: attributes.sameSite,
    httpOnly: attributes.httpOnly,
    secure: attributes.secure,
    maxAge: attributes.maxAge,
  });

  return response;
}
