"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import "./turnstile-widget.css";

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact" | "flexible";
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
    onHuTurnstileLoad?: () => void;
  }
}

const TURNSTILE_SCRIPT_ID = "cf-turnstile-script";
const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onHuTurnstileLoad";

export function resolveTurnstileSiteKey(): string {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";
}

export type TurnstileWidgetHandle = {
  /** Clear local token state and ask Cloudflare for a fresh challenge. */
  reset: () => void;
};

export interface TurnstileWidgetProps {
  onTokenChange: (token: string | null) => void;
  className?: string;
  theme?: "light" | "dark" | "auto";
  /**
   * Auth forms should use `flexible` so narrow PWA widths stay contained.
   * Blog may keep the historical default `normal`.
   */
  size?: "normal" | "compact" | "flexible";
  "data-testid"?: string;
}

/**
 * Shared Cloudflare Turnstile host (STEP 15D.8E.3).
 * Owns script load, render, token callbacks, reset, and cleanup.
 */
export const TurnstileWidget = forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(
  function TurnstileWidget(
    {
      onTokenChange,
      className,
      theme = "auto",
      size = "normal",
      "data-testid": testId,
    },
    ref,
  ) {
    const widgetHostRef = useRef<HTMLDivElement | null>(null);
    const widgetIdRef = useRef<string | null>(null);
    const onTokenChangeRef = useRef(onTokenChange);
    const [siteKey] = useState(() => resolveTurnstileSiteKey());

    useEffect(() => {
      onTokenChangeRef.current = onTokenChange;
    }, [onTokenChange]);

    const reset = useCallback(() => {
      onTokenChangeRef.current(null);
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.reset(widgetIdRef.current);
        } catch {
          // Widget may already be gone.
        }
      }
    }, []);

    useImperativeHandle(ref, () => ({ reset }), [reset]);

    const renderWidget = useCallback(() => {
      if (!siteKey || !widgetHostRef.current || !window.turnstile) {
        return;
      }
      if (widgetIdRef.current) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore
        }
        widgetIdRef.current = null;
      }
      widgetHostRef.current.innerHTML = "";
      widgetIdRef.current = window.turnstile.render(widgetHostRef.current, {
        sitekey: siteKey,
        callback: (token: string) => {
          onTokenChangeRef.current(token);
        },
        "expired-callback": () => {
          onTokenChangeRef.current(null);
        },
        "error-callback": () => {
          onTokenChangeRef.current(null);
        },
        theme,
        size,
      });
    }, [siteKey, theme, size]);

    useEffect(() => {
      if (!siteKey) {
        return;
      }

      const previousOnLoad = window.onHuTurnstileLoad;
      window.onHuTurnstileLoad = () => {
        previousOnLoad?.();
        renderWidget();
      };

      const existing = document.getElementById(TURNSTILE_SCRIPT_ID);
      if (window.turnstile) {
        renderWidget();
      } else if (!existing) {
        const script = document.createElement("script");
        script.id = TURNSTILE_SCRIPT_ID;
        script.src = TURNSTILE_SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }

      return () => {
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {
            // ignore
          }
          widgetIdRef.current = null;
        }
        onTokenChangeRef.current(null);
      };
    }, [siteKey, renderWidget]);

    if (!siteKey) {
      return null;
    }

    return (
      <div
        className={["hu-turnstile", className].filter(Boolean).join(" ")}
        ref={widgetHostRef}
        data-testid={testId}
        data-hu-turnstile-size={size}
      />
    );
  },
);

export { TURNSTILE_SCRIPT_ID, TURNSTILE_SCRIPT_SRC };
