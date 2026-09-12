"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
  type KeyboardEvent,
} from "react";

import { useClientAuthStatus } from "../../auth/use-client-auth-status";
import { getMyPreferences, updateMyPreferences } from "../../preferences/preferences-api";
import { readHuLangCookieFromDocument } from "../hu-lang-cookie.web";
import {
  PUBLIC_LANGUAGES_CHANGED_EVENT,
  formatLanguageOptionLabel,
  listSelectablePublicLanguages,
  type SelectablePublicLanguage,
} from "../public-languages-api";
import { markInterfaceLanguageCookieSynced } from "./InterfaceLanguageCookieSync";
import { writeHuLangCookieViaWebRoute } from "../write-hu-lang-cookie";
import { recordLocaleSwitchStarted } from "../media-plp/media-plp-locale-switch-machine";
import {
  markMediaLocaleSwitchPerfPhase,
} from "../media-plp/media-plp-locale-switch-perf";
import { resolveLocaleSwitchNavigationHref } from "../resolve-locale-switch-navigation-href";
import { runLocaleSwitchNavigation } from "../run-locale-switch-navigation";

import "./language-selector.css";

export { resolveLocaleSwitchNavigationHref } from "../resolve-locale-switch-navigation-href";
export { runLocaleSwitchNavigation } from "../run-locale-switch-navigation";

/** Visible language rows before the list scrolls (does not cap total languages). */
const LANGUAGE_SELECTOR_VISIBLE_ROWS = 10;

interface LanguageSelectorProps {
  readonly className?: string;
  /**
   * Optional override for the accessible label.
   * Default follows Pack 02D `common.language` for the active Pack 02C locale.
   */
  readonly label?: string;
  /**
   * `icon` — compact trigger using `/icons/messenger/language.png` (PWA/mobile menu).
   * Default remains the text/pill control used in the desktop header.
   */
  readonly variant?: "default" | "icon";
}

const LANGUAGE_ICON_SRC = "/icons/messenger/language.png";

/**
 * Pack 02C Task 03 — reusable language selector (enabled Registry languages only).
 * Guest: writes Web-origin `hu_lang` then refreshes for SSR lang/dir.
 * Authenticated: persists Participant `interfaceLanguage`, then syncs `hu_lang`.
 * Pack 02D — chrome label/status via next-intl; option names stay Registry-driven.
 * Pack 02F staging-smoke — refetch when Admin invalidates the public languages cache.
 */
export function LanguageSelector({
  className,
  label,
  variant = "default",
}: LanguageSelectorProps) {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const tCommon = useTranslations("common");
  const resolvedLabel = label ?? tCommon("language");
  const loadingLabel = tCommon("loading");
  const errorLabel = tCommon("error");
  const authStatus = useClientAuthStatus();
  const selectId = useId();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [options, setOptions] = useState<readonly SelectablePublicLanguage[]>([]);
  const [value, setValue] = useState("en");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [catalogEpoch, setCatalogEpoch] = useState(0);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const onLanguagesChanged = () => {
      setCatalogEpoch((current) => current + 1);
    };
    window.addEventListener(PUBLIC_LANGUAGES_CHANGED_EVENT, onLanguagesChanged);
    return () => {
      window.removeEventListener(PUBLIC_LANGUAGES_CHANGED_EVENT, onLanguagesChanged);
    };
  }, []);

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
          setError(errorLabel);
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
  }, [errorLabel, catalogEpoch]);

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

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const applyLocale = useCallback(
    async (locale: string) => {
      setError(null);
      markMediaLocaleSwitchPerfPhase("T0_SELECTOR");

      // Reset 03D — parallelize independent writes of the same locale string.
      // Cookie remains required for Web SSR; prefs remain required when authenticated.
      const preferenceWrite =
        authStatus === "authenticated"
          ? updateMyPreferences({
              // API accepts partial experiencePreferences; validator merges interfaceLanguage only.
              experiencePreferences: { interfaceLanguage: locale } as never,
            })
          : Promise.resolve();

      const [written] = await Promise.all([
        writeHuLangCookieViaWebRoute(locale),
        preferenceWrite,
      ]);

      markMediaLocaleSwitchPerfPhase("T1_PREFERENCE_COOKIE");
      setValue(written.locale);
      if (authStatus === "authenticated") {
        markInterfaceLanguageCookieSynced(written.locale);
      }
      // Reset 03C.2 — locale switch ownership starts here; Media PLP completes after refresh.
      recordLocaleSwitchStarted(written.locale);
      markMediaLocaleSwitchPerfPhase("T2_NAVIGATION_START");
      const href = resolveLocaleSwitchNavigationHref({
        pathname,
        nextLocale: written.locale,
      });
      // Implementation 03 — replace updates the SEO URL; refresh re-fetches
      // locale-scoped Server Component payloads (Media PLP maps). Soft nav
      // without refresh left previous-locale SSR props authoritative.
      startTransition(() => {
        runLocaleSwitchNavigation({
          router,
          pathname,
          href,
        });
      });
    },
    [authStatus, pathname, router],
  );

  const currentLocale = options.some((row) => row.locale === value)
    ? value
    : (options[0]?.locale ?? "en");
  const currentOption =
    options.find((row) => row.locale === currentLocale) ?? options[0]!;
  const disabled = pending || authStatus === "pending";

  async function commitLocale(next: string) {
    const previous = value;
    if (next === previous) {
      setOpen(false);
      return;
    }
    setValue(next);
    setOpen(false);
    try {
      await applyLocale(next);
    } catch {
      if (authStatus !== "authenticated") {
        setValue(previous);
      }
      setError(errorLabel);
    }
  }

  function openList() {
    if (disabled) {
      return;
    }
    const index = Math.max(
      0,
      options.findIndex((row) => row.locale === currentLocale),
    );
    setActiveIndex(index);
    setOpen(true);
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) {
      return;
    }
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!open) {
        openList();
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        void commitLocale(options[activeIndex]?.locale ?? currentLocale);
      }
    }
    if (event.key === "ArrowUp" && open) {
      event.preventDefault();
      setActiveIndex((index) => Math.max(0, index - 1));
    }
    if (event.key === "ArrowDown" && open) {
      event.preventDefault();
      setActiveIndex((index) => Math.min(options.length - 1, index + 1));
    }
    if (event.key === "Home" && open) {
      event.preventDefault();
      setActiveIndex(0);
    }
    if (event.key === "End" && open) {
      event.preventDefault();
      setActiveIndex(options.length - 1);
    }
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
    }
  }

  if (loading && options.length === 0) {
    return (
      <div
        className={["hu-language-selector", "hu-language-selector--pending", className]
          .filter(Boolean)
          .join(" ")}
        role="status"
        aria-label={loadingLabel}
      >
        <span className="hu-visually-hidden">{loadingLabel}</span>
      </div>
    );
  }

  if (options.length === 0) {
    return null;
  }

  return (
    <div
      ref={rootRef}
      className={[
        "hu-language-selector",
        variant === "icon" ? "hu-language-selector--icon" : null,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-pending={pending ? "true" : undefined}
      data-open={open ? "true" : undefined}
      style={
        {
          ["--hu-language-selector-visible-rows" as string]: String(
            LANGUAGE_SELECTOR_VISIBLE_ROWS,
          ),
        } as CSSProperties
      }
    >
      <div className="hu-language-selector__label">
        <span className="hu-visually-hidden" id={`${selectId}-label`}>
          {resolvedLabel}
        </span>
        <button
          type="button"
          id={selectId}
          className={
            variant === "icon"
              ? "hu-language-selector__icon-trigger"
              : "hu-language-selector__select"
          }
          aria-label={resolvedLabel}
          aria-labelledby={`${selectId}-label`}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          title={resolvedLabel}
          disabled={disabled}
          onClick={() => {
            if (open) {
              setOpen(false);
            } else {
              openList();
            }
          }}
          onKeyDown={onTriggerKeyDown}
        >
          {variant === "icon" ? (
            <>
              <img
                src={LANGUAGE_ICON_SRC}
                alt=""
                width={20}
                height={20}
                className="hu-language-selector__icon"
                aria-hidden="true"
              />
              <span className="hu-language-selector__icon-text">
                {formatLanguageOptionLabel(currentOption)}
              </span>
            </>
          ) : (
            formatLanguageOptionLabel(currentOption)
          )}
        </button>
      </div>
      {open ? (
        <ul
          id={listId}
          className="hu-language-selector__list"
          role="listbox"
          aria-labelledby={`${selectId}-label`}
          tabIndex={-1}
        >
          {options.map((option, index) => {
            const selected = option.locale === currentLocale;
            const active = index === activeIndex;
            return (
              <li key={option.languageId} role="presentation">
                <button
                  type="button"
                  role="option"
                  className={[
                    "hu-language-selector__option",
                    selected ? "hu-language-selector__option--selected" : null,
                    active ? "hu-language-selector__option--active" : null,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  lang={option.locale}
                  aria-selected={selected}
                  tabIndex={active ? 0 : -1}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => void commitLocale(option.locale)}
                >
                  {formatLanguageOptionLabel(option)}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {error ? (
        <p className="hu-language-selector__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
