import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import type { TabId, Player, EventState } from "../shared/types";
import { EVENTS, TIERS_ORDER, TIER_CONFIG, MAX_PICKS, MAX_NAME_LENGTH, POLL_INTERVAL_MS } from "../shared/constants";
import {
  fetchEvents,
  fetchPlayers,
  submitPicks,
  toggleEvent as apiToggleEvent,
  removePlayer as apiRemovePlayer,
  resetGame as apiResetGame,
} from "./api/client";
import { usePolling } from "./hooks/usePolling";
import { useHashRoute } from "./hooks/useHashRoute";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { Header } from "./components/Header";
import { PickCounter } from "./components/PickCounter";
import { TierSection } from "./components/TierSection";
import { LockedScreen } from "./components/LockedScreen";
import { LiveBoard } from "./components/LiveBoard";
import { PrizesTab } from "./components/PrizesTab";
import { AdminTab } from "./components/AdminTab";

const TAB_ITEMS: { id: TabId; label: string; icon: string }[] = [
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
  const [tab, setTab] = useHashRoute("picks");
  const [submitted, setSubmitted] = useState(
    () => localStorage.getItem("sb-submitted") === "true"
  );
  const [playerName, setPlayerName] = useState("");
  const [tiebreaker, setTiebreaker] = useState("");
  const [selectedPicks, setSelectedPicks] = useState<string[]>([]);
  const [adminAuth, setAdminAuth] = useState(false);
  const [adminCode, setAdminCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasLoadedRef = useRef(false);

  const loadData = useCallback(async () => {
    try {
      const [ev, pl] = await Promise.all([fetchEvents(), fetchPlayers()]);
      setEventState(ev);
      setPlayers(pl);
      hasLoadedRef.current = true;
      setLoadError(false);
    } catch {
      if (!hasLoadedRef.current) setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const shouldPoll = tab === "live" || tab === "admin" || tab === "prizes";
  usePolling(loadData, POLL_INTERVAL_MS, shouldPoll);

  const handleTabChange = (value: string) => {
    setTab(value as TabId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const togglePick = (id: string) => {
    setSelectedPicks((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= MAX_PICKS) return prev;
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
      localStorage.setItem("sb-submitted", "true");
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

  const handleReset = async () => {
    try {
      await apiResetGame(adminCode);
      setEventState({});
      setPlayers([]);
      toast.success("Game reset!");
    } catch {
      toast.error("Error resetting game");
    }
  };

  const handleAdminAuth = (code: string) => {
    setAdminAuth(true);
    setAdminCode(code);
  };

  const totalHits = Object.values(eventState).filter(Boolean).length;

  const tierGroups = TIERS_ORDER.map((tier) => ({
    tier,
    config: TIER_CONFIG[tier],
    events: EVENTS.filter((e) => e.tier === tier),
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
            value="picks"
            className="data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:duration-200 mt-0"
          >
            {submitted ? (
              <LockedScreen onGoToLive={() => setTab("live")} />
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
                      TIEBREAKER: PREDICT FINAL SCORE
                    </label>
                    <Input
                      value={tiebreaker}
                      onChange={(e) => setTiebreaker(e.target.value)}
                      placeholder="e.g. Chiefs 27, Eagles 24"
                      className="bg-input border-white/10 text-white"
                    />
                  </div>
                </div>

                <PickCounter selectedCount={selectedPicks.length} />

                {tierGroups.map(({ tier, config, events }) => (
                  <TierSection
                    key={tier}
                    tier={tier}
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
            <LiveBoard eventState={eventState} totalHits={totalHits} />
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
              onAdminAuth={handleAdminAuth}
              onToggleEvent={handleToggleEvent}
              onRemovePlayer={handleRemovePlayer}
              onReset={handleReset}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

export default App;
