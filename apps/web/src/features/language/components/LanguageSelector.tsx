"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useState, useTransition } from "react";

import { useClientAuthStatus } from "../../auth/use-client-auth-status";
import { getMyPreferences, updateMyPreferences } from "../../preferences/preferences-api";
import { readHuLangCookieFromDocument } from "../hu-lang-cookie.web";
import {
  formatLanguageOptionLabel,
  listSelectablePublicLanguages,
  type SelectablePublicLanguage,
} from "../public-languages-api";
import { markInterfaceLanguageCookieSynced } from "./InterfaceLanguageCookieSync";
import { writeHuLangCookieViaWebRoute } from "../write-hu-lang-cookie";

import "./language-selector.css";

interface LanguageSelectorProps {
  readonly className?: string;
  /** Compact label for header; default "Language". */
  readonly label?: string;
}

/**
 * Pack 02C Task 03 — reusable language selector (enabled Registry languages only).
 * Guest: writes Web-origin `hu_lang` then refreshes for SSR lang/dir.
 * Authenticated: persists Participant `interfaceLanguage`, then syncs `hu_lang`.
 */
export function LanguageSelector({
  className,
  label = "Language",
}: LanguageSelectorProps) {
  const router = useRouter();
  const authStatus = useClientAuthStatus();
  const selectId = useId();
  const [options, setOptions] = useState<readonly SelectablePublicLanguage[]>([]);
  const [value, setValue] = useState("en");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const languages = await listSelectablePublicLanguages();
        if (cancelled) {
          return;
        }
        setOptions(languages);
        setError(null);
      } catch {
        if (!cancelled) {
          setError("Languages unavailable.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (options.length === 0 || authStatus === "pending") {
      return;
    }

    let cancelled = false;

    void (async () => {
      let nextValue = options.some((row) => row.locale === "en")
        ? "en"
        : (options[0]?.locale ?? "en");

      if (authStatus === "authenticated") {
        try {
          const preferences = await getMyPreferences();
          if (cancelled) {
            return;
          }
          const interfaceLanguage = preferences.experiencePreferences.interfaceLanguage;
          if (options.some((row) => row.locale === interfaceLanguage)) {
            nextValue = interfaceLanguage;
          }
        } catch {
          const cookie = readHuLangCookieFromDocument();
          if (cookie && options.some((row) => row.locale === cookie)) {
            nextValue = cookie;
          }
        }
      } else {
        const cookie = readHuLangCookieFromDocument();
        if (cookie && options.some((row) => row.locale === cookie)) {
          nextValue = cookie;
        }
      }

      if (!cancelled) {
        setValue(nextValue);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authStatus, options]);

  const applyLocale = useCallback(
    async (locale: string) => {
      setError(null);

      if (authStatus === "authenticated") {
        await updateMyPreferences({
          // API accepts partial experiencePreferences; validator merges interfaceLanguage only.
          experiencePreferences: { interfaceLanguage: locale } as never,
        });
      }

      // Preference may already be saved — keep UI on `locale` even if cookie write fails.
      const written = await writeHuLangCookieViaWebRoute(locale);
      setValue(written.locale);
      if (authStatus === "authenticated") {
        markInterfaceLanguageCookieSynced(written.locale);
      }
      startTransition(() => {
        router.refresh();
      });
    },
    [authStatus, router],
  );

  async function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value;
    const previous = value;
    setValue(next);

    try {
      await applyLocale(next);
    } catch (applyError) {
      // If prefs already persisted, keep `next`; only roll back when guest cookie write fails
      // or prefs write failed before cookie.
      if (authStatus !== "authenticated") {
        setValue(previous);
      }
      setError(
        applyError instanceof Error ? applyError.message : "Unable to change language.",
      );
    }
  }

  if (loading && options.length === 0) {
    return (
      <div
        className={["hu-language-selector", "hu-language-selector--pending", className]
          .filter(Boolean)
          .join(" ")}
        aria-hidden="true"
      />
    );
  }

  if (options.length === 0) {
    return null;
  }

  return (
    <div
      className={["hu-language-selector", className].filter(Boolean).join(" ")}
      data-pending={pending ? "true" : undefined}
    >
      <label className="hu-language-selector__label" htmlFor={selectId}>
        <span className="hu-visually-hidden">{label}</span>
        <select
          id={selectId}
          className="hu-language-selector__select"
          value={
            options.some((row) => row.locale === value) ? value : (options[0]?.locale ?? "en")
          }
          onChange={(event) => void handleChange(event)}
          disabled={pending || authStatus === "pending"}
          aria-label={label}
          title={label}
        >
          {options.map((option) => (
            <option key={option.languageId} value={option.locale} lang={option.locale}>
              {formatLanguageOptionLabel(option)}
            </option>
          ))}
        </select>
      </label>
      {error ? (
        <p className="hu-language-selector__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
