"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import type { ResolvedLocalizedBrand } from "@hu/types";

import {
  getBuiltinEnglishBrand,
  resolveLocalizedBrandForLocale,
} from "./resolve-localized-brand";

/**
 * Client hook — Admin-managed localized brand for current next-intl locale.
 * Starts with builtin English, then hydrates from public API.
 */
export function useLocalizedBrand(): ResolvedLocalizedBrand {
  const locale = useLocale();
  const [brand, setBrand] = useState<ResolvedLocalizedBrand>(() =>
    getBuiltinEnglishBrand(locale),
  );

  useEffect(() => {
    let cancelled = false;
    setBrand(getBuiltinEnglishBrand(locale));
    void resolveLocalizedBrandForLocale(locale).then((resolved) => {
      if (!cancelled) {
        setBrand(resolved);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  return brand;
}
