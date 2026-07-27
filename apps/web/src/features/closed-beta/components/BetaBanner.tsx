"use client";

import { useEffect, useState } from "react";

import { getPlatformConfig } from "../platform-api";

export function BetaBanner() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void getPlatformConfig()
      .then((config) => {
        if (!cancelled && config.showBetaBanner) {
          setMessage(config.betaBannerMessage);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMessage(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!message) {
    return null;
  }

  return (
    <div className="beta-banner" role="status" aria-live="polite">
      <div className="beta-banner__inner hu-status-banner">
        <p className="hu-status-banner__title">Closed Beta</p>
        <p className="hu-status-banner__message">{message}</p>
      </div>
    </div>
  );
}
