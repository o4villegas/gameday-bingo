import { useState, useEffect, useCallback } from "react";
import type { TabId } from "../../shared/types";

const VALID_TABS: TabId[] = ["picks", "live", "prizes", "admin"];

function isValidTab(value: string): value is TabId {
  return VALID_TABS.includes(value as TabId);
}

function readTabFromHash(): TabId | null {
  const hash = window.location.hash.replace("#", "");
  return isValidTab(hash) ? hash : null;
}

export function useHashRoute(
  defaultTab: TabId
): [TabId, (tab: TabId) => void] {
  const [tab, setTabState] = useState<TabId>(
    () => readTabFromHash() ?? defaultTab
  );

  const setTab = useCallback((newTab: TabId) => {
    setTabState(newTab);
    window.location.hash = `#${newTab}`;
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      const parsed = readTabFromHash();
      if (parsed) {
        setTabState(parsed);
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  return [tab, setTab];
}
