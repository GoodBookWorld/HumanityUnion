"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Card } from "../../../design-system/components/Card";
import { Button } from "../../../design-system/components/Button";
import type { BetaOnboardingItem } from "@hu/types";

import { resolveWorkspaceBetaItemLabel } from "../../workspace-home/workspace-home-i18n";
import { getBetaOnboarding } from "../platform-api";

import "../closed-beta.css";

const DISMISS_STORAGE_KEY = "hu-beta-onboarding-dismissed";

export function BetaOnboardingChecklist() {
  const t = useTranslations("workspace");
  const [items, setItems] = useState<BetaOnboardingItem[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setDismissed(window.localStorage.getItem(DISMISS_STORAGE_KEY) === "true");
  }, []);

  useEffect(() => {
    let cancelled = false;

    void getBetaOnboarding()
      .then((nextItems) => {
        if (!cancelled) {
          setItems(nextItems);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded || dismissed || items.length === 0) {
    return null;
  }

  const allComplete = items.every((item) => item.completed);

  if (allComplete) {
    return null;
  }

  function dismissChecklist() {
    window.localStorage.setItem(DISMISS_STORAGE_KEY, "true");
    setDismissed(true);
  }

  return (
    <Card className="beta-onboarding">
      <div className="beta-onboarding__header">
        <h2 className="beta-onboarding__title">{t("home.beta.title")}</h2>
        <Button type="button" variant="secondary" onClick={dismissChecklist}>
          {t("home.beta.dismiss")}
        </Button>
      </div>
      <ul className="beta-onboarding__list">
        {items.map((item) => {
          const label = resolveWorkspaceBetaItemLabel(t, item.id);
          return (
            <li
              key={item.id}
              className={
                item.completed
                  ? "beta-onboarding__item beta-onboarding__item--complete"
                  : "beta-onboarding__item"
              }
            >
              <span aria-hidden="true">{item.completed ? "✓" : "○"}</span>
              {item.completed ? <span>{label}</span> : <Link href={item.href}>{label}</Link>}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
