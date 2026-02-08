import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import type { TabId, Player, EventState, VerificationResult, Period } from "../shared/types";
import { EVENTS, PERIODS_ORDER, PERIOD_CONFIG, MAX_PICKS, MAX_PICKS_PER_PERIOD, MAX_NAME_LENGTH, MAX_TIEBREAKER_LENGTH, POLL_INTERVAL_MS } from "../shared/constants";
import {
  fetchEvents,
  fetchPlayers,
  submitPicks,
  toggleEvent as apiToggleEvent,
  removePlayer as apiRemovePlayer,
  resetGame as apiResetGame,
  triggerVerification as apiTriggerVerification,
  approveVerification as apiApproveVerification,
  dismissVerification as apiDismissVerification,
  fetchGameLockStatus,
  toggleGameLock,
} from "./api/client";
import { usePolling } from "./hooks/usePolling";
import { useHashRoute } from "./hooks/useHashRoute";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { safeGetItem, safeSetItem, safeRemoveItem } from "./lib/safeLocalStorage";
import { Header } from "./components/Header";
import { PickCounter } from "./components/PickCounter";
import { PeriodSection } from "./components/PeriodSection";
import { LockedScreen } from "./components/LockedScreen";
import { ClosedScreen } from "./components/ClosedScreen";
import { LiveBoard } from "./components/LiveBoard";
import { PrizesTab } from "./components/PrizesTab";
import { AdminTab } from "./components/AdminTab";
import { RulesPage } from "./components/RulesPage";

const TAB_ITEMS: { id: TabId; label: string; icon: string }[] = [
  { id: "rules", label: "RULES", icon: "\u{1F4CB}" },
  { id: "picks", label: "PICKS", icon: "\u270D\uFE0F" },
  { id: "live", label: "LIVE", icon: "\u{1F4E1}" },
  { id: "prizes", label: "PRIZES", icon: "\u{1F3C6}" },
  { id: "admin", label: "ADMIN", icon: "\u2699\uFE0F" },
];

function App() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [eventState, setEventState] = useState<EventState>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [tab, setTab] = useHashRoute(
    safeGetItem("sb-submitted") === "true" ? "live" : "rules"
  );
  const [submitted, setSubmitted] = useState(
    () => safeGetItem("sb-submitted") === "true"
  );
  const [playerName, setPlayerName] = useState("");
  const [tiebreaker, setTiebreaker] = useState("");
  const [selectedPicks, setSelectedPicks] = useState<string[]>([]);
  const [adminAuth, setAdminAuth] = useState(false);
  const [adminCode, setAdminCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [gameLocked, setGameLocked] = useState(false);
  const [periodsVerified, setPeriodsVerified] = useState<Period[]>([]);

  const hasLoadedRef = useRef(false);

  const loadData = useCallback(async () => {
    try {
      const [ev, pl] = await Promise.all([fetchEvents(), fetchPlayers()]);
      setEventState(ev);
      setPlayers(pl);
      hasLoadedRef.current = true;
      setLoadError(false);

      // Self-healing: clear submission lock if player no longer exists server-side
      if (safeGetItem("sb-submitted") === "true") {
        const savedName = safeGetItem("sb-submitted-name");
        if (savedName && !pl.some((p) => p.name.toLowerCase() === savedName)) {
          safeRemoveItem("sb-submitted");
          safeRemoveItem("sb-submitted-name");
          setSubmitted(false);
        }
      }

      // Fetch lock status independently — failure doesn't block event/player updates
      const gs = await fetchGameLockStatus().catch(() => null);
      if (gs) {
        setGameLocked(gs.locked);
        setPeriodsVerified(gs.periodsVerified ?? []);
      }
    } catch {
      if (!hasLoadedRef.current) setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const shouldPoll = tab === "live" || tab === "admin" || tab === "prizes" || tab === "picks";
  usePolling(loadData, POLL_INTERVAL_MS, shouldPoll);

  const handleTabChange = (value: string) => {
    setTab(value as TabId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const togglePick = (id: string) => {
    setSelectedPicks((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= MAX_PICKS) return prev;
      const event = EVENTS.find((e) => e.id === id);
      if (!event) return prev;
      const periodCount = prev.filter(
        (p) => EVENTS.find((e) => e.id === p)?.period === event.period
      ).length;
      if (periodCount >= MAX_PICKS_PER_PERIOD) return prev;
      return [...prev, id];
    });
  };

  const handleSubmitPicks = async () => {
    if (!playerName.trim()) {
      toast.error("Enter your name!");
      return;
    }
    if (selectedPicks.length !== MAX_PICKS) {
      toast.error(`Select exactly ${MAX_PICKS} predictions!`);
      return;
    }
    setIsSubmitting(true);
    try {
      await submitPicks({
        name: playerName.trim(),
        picks: selectedPicks,
        tiebreaker: tiebreaker.trim(),
      });
      safeSetItem("sb-submitted", "true");
      safeSetItem("sb-submitted-name", playerName.trim().toLowerCase());
      setSubmitted(true);
      toast.success("Picks locked in!");
      setTab("live");
      await loadData();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error saving picks. Try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleEvent = async (id: string) => {
    const prev = eventState;
    const updated = { ...eventState, [id]: !eventState[id] };
    setEventState(updated);
    try {
      const serverState = await apiToggleEvent(id, adminCode);
      setEventState(serverState);
    } catch {
      setEventState(prev);
      toast.error("Error saving");
    }
  };

  const handleRemovePlayer = async (name: string) => {
    try {
      await apiRemovePlayer(name, adminCode);
      setPlayers((prev) => prev.filter((p) => p.name.toLowerCase() !== name.toLowerCase()));
      toast.success(`Removed ${name}`);
    } catch {
      toast.error("Error removing player");
    }
  };

  const handleToggleLock = async () => {
    try {
      const result = await toggleGameLock(adminCode);
      setGameLocked(result.locked);
      toast.success(result.locked ? "Submissions locked!" : "Submissions unlocked!");
    } catch {
      toast.error("Error toggling submission lock");
    }
  };

  const handleReset = async () => {
    try {
      await apiResetGame(adminCode);
      setEventState({});
      setPlayers([]);
      setVerificationResult(null);
      setGameLocked(false);
      setPeriodsVerified([]);
      toast.success("Game reset!");
    } catch {
      toast.error("Error resetting game");
    }
  };

  const handleAdminAuth = (code: string) => {
    setAdminAuth(true);
    setAdminCode(code);
  };

  const handleVerifyPeriod = async (period: Period, manualText?: string) => {
    setVerificationLoading(true);
    try {
      const result = await apiTriggerVerification(period, adminCode, manualText);
      setVerificationResult(result);
      toast.success(`AI verification complete for ${period}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Verification failed"
      );
    } finally {
      setVerificationLoading(false);
    }
  };

  const handleApproveVerification = async () => {
    try {
      const approvedPeriod = verificationResult?.period;
      const updatedEvents = await apiApproveVerification(adminCode);
      setEventState(updatedEvents);
      if (approvedPeriod && !periodsVerified.includes(approvedPeriod)) {
        setPeriodsVerified((prev) => [...prev, approvedPeriod]);
      }
      setVerificationResult(null);
      toast.success("Verification results applied!");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to approve"
      );
    }
  };

  const handleDismissVerification = async () => {
    try {
      await apiDismissVerification(adminCode);
      setVerificationResult(null);
      toast.success("Verification dismissed");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to dismiss"
      );
    }
  };

  const totalHits = Object.values(eventState).filter(Boolean).length;

  // Derive current user's picks from players array + localStorage name
  const currentUserName = safeGetItem("sb-submitted-name");
  const currentUserPicks = currentUserName
    ? (players.find((p) => p.name.toLowerCase() === currentUserName)?.picks ?? [])
    : [];

  const periodGroups = PERIODS_ORDER.map((period) => ({
    period,
    config: PERIOD_CONFIG[period],
    events: EVENTS.filter((e) => e.period === period),
  }));

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground font-body flex flex-col items-center justify-center">
        <div className="text-5xl mb-4">{"\u{1F3C8}"}</div>
        <div className="font-heading text-xs tracking-[3px] text-muted-foreground animate-pulse">
          LOADING...
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-background text-foreground font-body flex flex-col items-center justify-center">
        <div className="text-5xl mb-4">{"\u26A0\uFE0F"}</div>
        <div className="font-heading text-sm tracking-[2px] text-destructive mb-4">
          FAILED TO LOAD
        </div>
        <Button onClick={loadData}>Try Again</Button>
      </div>
    );
  }

  const canSubmit = selectedPicks.length === MAX_PICKS && !!playerName.trim() && !isSubmitting;

  return (
    <div className="min-h-screen bg-background text-foreground font-body">
      <Header playerCount={players.length} totalHits={totalHits} />

      <Tabs value={tab} onValueChange={handleTabChange} className="gap-0">
        <TabsList className="w-full rounded-none border-b border-border bg-background h-[var(--tab-height)] group-data-[orientation=horizontal]/tabs:h-[var(--tab-height)] p-0 sticky top-0 z-50">
          {TAB_ITEMS.map((t) => (
            <TabsTrigger
              key={t.id}
              value={t.id}
              className="flex-1 font-heading text-xs tracking-[2px] rounded-none border-none data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:bg-transparent h-full"
            >
              <span className="mr-1">{t.icon}</span>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto">
          <TabsContent
            value="rules"
            className="data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:duration-200 mt-0"
          >
            <RulesPage onGoToPicks={() => setTab("picks")} />
          </TabsContent>

          <TabsContent
            value="picks"
            className="data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:duration-200 mt-0"
          >
            {submitted ? (
              <LockedScreen onGoToLive={() => setTab("live")} userPicks={currentUserPicks} eventState={eventState} />
            ) : gameLocked ? (
              <ClosedScreen />
            ) : (
              <>
                {/* Name + Tiebreaker Form */}
                <div className="px-4 pt-5 pb-0">
                  <div className="bg-overlay-light rounded-lg px-4 py-4 border border-border">
                    <label className="block font-heading text-[0.6875rem] tracking-[2px] text-muted-foreground mb-1.5">
                      YOUR NAME
                    </label>
                    <Input
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      placeholder="Enter your name"
                      maxLength={MAX_NAME_LENGTH}
                      className="bg-input border-white/10 text-white"
                    />
                    {playerName.length > MAX_NAME_LENGTH - 10 && (
                      <div className={`text-[0.625rem] mt-1 font-heading tracking-[1px] ${playerName.length >= MAX_NAME_LENGTH ? "text-destructive" : "text-muted-foreground"}`}>
                        {playerName.length}/{MAX_NAME_LENGTH}
                      </div>
                    )}
                    <label className="block font-heading text-[0.6875rem] tracking-[2px] text-muted-foreground mb-1.5 mt-3">
                      BONUS: PREDICT FINAL SCORE
                    </label>
                    <div className="text-[0.5625rem] text-white/30 mb-1.5 font-heading tracking-[1px]">
                      for fun — ties broken by earliest submission
                    </div>
                    <Input
                      value={tiebreaker}
                      onChange={(e) => setTiebreaker(e.target.value)}
                      placeholder="e.g. Seahawks 27, Patriots 24"
                      maxLength={MAX_TIEBREAKER_LENGTH}
                      className="bg-input border-white/10 text-white"
                    />
                  </div>
                </div>

                <PickCounter selectedPicks={selectedPicks} />

                {periodGroups.map(({ period, config, events }) => (
                  <PeriodSection
                    key={period}
                    period={period}
                    config={config}
                    events={events}
                    selectedPicks={selectedPicks}
                    onTogglePick={togglePick}
                  />
                ))}

                <div className="px-4 py-5">
                  <Button
                    onClick={handleSubmitPicks}
                    disabled={!canSubmit}
                    className="w-full h-12 font-heading text-sm tracking-[2px]"
                    variant={canSubmit ? "default" : "secondary"}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        SUBMITTING...
                      </>
                    ) : (
                      <>{"\u{1F512}"} LOCK IN PICKS</>
                    )}
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent
            value="live"
            className="data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:duration-200 mt-0"
          >
            <LiveBoard eventState={eventState} totalHits={totalHits} userPicks={currentUserPicks} periodsVerified={periodsVerified} />
          </TabsContent>

          <TabsContent
            value="prizes"
            className="data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:duration-200 mt-0"
          >
            <PrizesTab players={players} eventState={eventState} />
          </TabsContent>

          <TabsContent
            value="admin"
            className="data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:duration-200 mt-0"
          >
            <AdminTab
              adminAuth={adminAuth}
              eventState={eventState}
              players={players}
              gameLocked={gameLocked}
              onAdminAuth={handleAdminAuth}
              onToggleEvent={handleToggleEvent}
              onRemovePlayer={handleRemovePlayer}
              onReset={handleReset}
              onToggleLock={handleToggleLock}
              verificationResult={verificationResult}
              verificationLoading={verificationLoading}
              onVerifyPeriod={handleVerifyPeriod}
              onApproveVerification={handleApproveVerification}
              onDismissVerification={handleDismissVerification}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

export default App;
