import { useEffect, useRef, useCallback } from "react";

const MAX_BACKOFF_MS = 60_000;

export function usePolling(
  callback: () => void | Promise<void>,
  intervalMs: number,
  enabled: boolean
) {
  const savedCallback = useRef(callback);
  const consecutiveErrors = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    savedCallback.current = callback;
  });

  const getEffectiveInterval = useCallback(() => {
    if (consecutiveErrors.current === 0) return intervalMs;
    const backoff = intervalMs * Math.pow(2, consecutiveErrors.current);
    return Math.min(backoff, MAX_BACKOFF_MS);
  }, [intervalMs]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const schedule = () => {
      if (cancelled) return;
      const delay = getEffectiveInterval();
      timerRef.current = setTimeout(async () => {
        if (cancelled) return;

        // Skip tick when page is hidden
        if (document.visibilityState === "hidden") {
          schedule();
          return;
        }

        try {
          await savedCallback.current();
          consecutiveErrors.current = 0;
        } catch {
          consecutiveErrors.current += 1;
        }

        schedule();
      }, delay);
    };

    schedule();

    // When the page becomes visible again, fire an immediate tick
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && !cancelled) {
        // Clear the existing scheduled timer and run immediately
        if (timerRef.current !== null) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }

        (async () => {
          if (cancelled) return;
          try {
            await savedCallback.current();
            consecutiveErrors.current = 0;
          } catch {
            consecutiveErrors.current += 1;
          }
          schedule();
        })();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [intervalMs, enabled, getEffectiveInterval]);
}
