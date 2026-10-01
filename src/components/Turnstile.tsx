"use client";
import { Box } from "@mui/material";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

/** Public site key (NEXT_PUBLIC_). When it is not set, the widget is skipped entirely. */
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
export const turnstileEnabled = SITE_KEY.length > 0;

interface TurnstileApi {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptLoading: Promise<void> | null = null;

function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  scriptLoading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptLoading = null;
      reject(new Error("Could not load the security check."));
    };
    document.head.appendChild(script);
  });
  return scriptLoading;
}

export interface TurnstileHandle {
  /** Tokens are single-use: reset after each submit so the next attempt gets a fresh one. */
  reset(): void;
}

/**
 * Cloudflare Turnstile ("I'm not a robot" check). Reports a token through `onToken`
 * (null when it expires or fails). Renders nothing when no site key is configured.
 */
export const Turnstile = forwardRef<TurnstileHandle, { onToken: (token: string | null) => void; action?: string }>(
  function Turnstile({ onToken, action }, ref) {
    const container = useRef<HTMLDivElement>(null);
    const widgetId = useRef<string | null>(null);
    const onTokenRef = useRef(onToken);
    onTokenRef.current = onToken;

    useImperativeHandle(ref, () => ({
      reset() {
        if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
        onTokenRef.current(null);
      },
    }));

    useEffect(() => {
      if (!turnstileEnabled) return;
      let cancelled = false;
      loadTurnstile()
        .then(() => {
          if (cancelled || !container.current || !window.turnstile) return;
          widgetId.current = window.turnstile.render(container.current, {
            sitekey: SITE_KEY,
            action,
            theme: "light",
            size: "flexible",
            callback: (token: string) => onTokenRef.current(token),
            "expired-callback": () => onTokenRef.current(null),
            "error-callback": () => onTokenRef.current(null),
          });
        })
        .catch(() => onTokenRef.current(null));
      return () => {
        cancelled = true;
        if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      };
    }, [action]);

    if (!turnstileEnabled) return null;
    return <Box ref={container} sx={{ minHeight: 65, width: "100%" }} />;
  },
);
