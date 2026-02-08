import { useEffect, useRef, useCallback, useState } from "react";

const MAX_BACKOFF_MS = 60_000;
const STALE_THRESHOLD_MS = 30_000;
const STALE_CHECK_INTERVAL_MS = 5_000;

export interface ConnectionHealth {
  lastSuccessAt: number | null;
  consecutiveErrors: number;
  isStale: boolean;
}

const INITIAL_HEALTH: ConnectionHealth = {
  lastSuccessAt: null,
  consecutiveErrors: 0,
  isStale: false,
};

export function usePolling(
  callback: () => void | Promise<void>,
  intervalMs: number,
  enabled: boolean
): ConnectionHealth {
  const savedCallback = useRef(callback);
  const consecutiveErrors = useRef(0);
  const lastSuccessRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [health, setHealth] = useState<ConnectionHealth>(INITIAL_HEALTH);

  useEffect(() => {
    savedCallback.current = callback;
  });

  const getEffectiveInterval = useCallback(() => {
    if (consecutiveErrors.current === 0) return intervalMs;
    const backoff = intervalMs * Math.pow(2, consecutiveErrors.current);
    return Math.min(backoff, MAX_BACKOFF_MS);
  }, [intervalMs]);

  const updateHealth = useCallback(() => {
    const now = Date.now();
    const elapsed = lastSuccessRef.current !== null ? now - lastSuccessRef.current : null;
    const isStale = elapsed !== null && elapsed > STALE_THRESHOLD_MS;
    setHealth({
      lastSuccessAt: lastSuccessRef.current,
      consecutiveErrors: consecutiveErrors.current,
      isStale,
    });
  }, []);

  const markSuccess = useCallback(() => {
    consecutiveErrors.current = 0;
    lastSuccessRef.current = Date.now();
    updateHealth();
  }, [updateHealth]);

  const markError = useCallback(() => {
    consecutiveErrors.current += 1;
    updateHealth();
  }, [updateHealth]);

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
          markSuccess();
        } catch {
          markError();
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
            markSuccess();
          } catch {
            markError();
          }
          schedule();
        })();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Periodic staleness checker — catches staleness between poll attempts during backoff
    const staleChecker = setInterval(() => {
      if (cancelled) return;
      if (lastSuccessRef.current !== null) {
        const elapsed = Date.now() - lastSuccessRef.current;
        if (elapsed > STALE_THRESHOLD_MS) {
          setHealth((prev) => (prev.isStale ? prev : { ...prev, isStale: true }));
        }
      }
    }, STALE_CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      clearInterval(staleChecker);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [intervalMs, enabled, getEffectiveInterval, markSuccess, markError]);

  return health;
}
