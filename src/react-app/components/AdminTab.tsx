import { useState } from "react";
import { toast } from "sonner";
import type { EventState, Player, VerificationResult, Period } from "../../shared/types";
import { EVENTS, PERIODS_ORDER, PERIOD_CONFIG } from "../../shared/constants";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { AdminEventRow } from "./AdminEventRow";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const ADMIN_CODE = "kava60";

interface AdminTabProps {
  adminAuth: boolean;
  eventState: EventState;
  players: Player[];
  onAdminAuth: (code: string) => void;
  onToggleEvent: (id: string) => void;
  onRemovePlayer: (name: string) => void;
  onReset: () => void;
  verificationResult: VerificationResult | null;
  verificationLoading: boolean;
  onVerifyPeriod: (period: Period, manualText?: string) => void;
  onApproveVerification: () => void;
  onDismissVerification: () => void;
}

export function AdminTab({
  adminAuth,
  eventState,
  players,
  onAdminAuth,
  onToggleEvent,
  onRemovePlayer,
  onReset,
  verificationResult,
  verificationLoading,
  onVerifyPeriod,
  onApproveVerification,
  onDismissVerification,
}: AdminTabProps) {
  const [codeInput, setCodeInput] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("Q1");
  const [manualText, setManualText] = useState("");
  const [showFallback, setShowFallback] = useState(false);

  const handleAuth = () => {
    if (codeInput === ADMIN_CODE) {
      toast.dismiss();
      onAdminAuth(codeInput);
    } else {
      toast.error("Wrong code");
    }
  };

  if (!adminAuth) {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-1 duration-300">
        <div className="px-6 pt-16 pb-16 text-center">
          <div className="text-4xl mb-3">{"\u{1F510}"}</div>
          <div className="font-heading text-xs tracking-[3px] text-muted-foreground mb-4">
            ADMIN ACCESS
          </div>
          <Input
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAuth(); }}
            type="password"
            placeholder="Enter code"
            className="w-[200px] mx-auto text-center bg-input border-white/10 text-white"
          />
          <div className="mt-3">
            <Button onClick={handleAuth} className="font-heading tracking-[2px] font-bold">
              ENTER
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 duration-300">
      {/* Event Controls Header */}
      <div className="flex justify-between items-center px-4 pt-4 pb-1">
        <div className="font-heading text-xs tracking-[3px] text-primary">
          {"\u2699\uFE0F"} EVENT CONTROLS
        </div>
        <Button
          variant="destructive"
          size="xs"
          className="font-heading tracking-[2px]"
          onClick={() => setResetOpen(true)}
        >
          RESET ALL
        </Button>
      </div>
      <div className="px-4 mb-2 text-[0.6875rem] text-white/30">
        Toggle events as they happen. Changes are live for all viewers.
      </div>

      {/* AI Verification Panel */}
      <div className="mx-4 my-3 bg-overlay-light rounded-lg border border-border p-4">
        <div className="font-heading text-xs tracking-[3px] text-primary mb-3">
          {"\u{1F916}"} AI VERIFICATION
        </div>

        {/* Period Selector */}
        <div className="flex gap-1.5 mb-3 flex-wrap">
          {PERIODS_ORDER.map((period) => {
            const config = PERIOD_CONFIG[period];
            return (
              <Button
                key={period}
                variant={selectedPeriod === period ? "default" : "outline"}
                size="sm"
                className="font-heading text-[0.625rem] tracking-[1px]"
                onClick={() => setSelectedPeriod(period)}
              >
                {config.emoji} {period}
              </Button>
            );
          })}
        </div>

        {/* Verify Button */}
        <Button
          onClick={() => onVerifyPeriod(selectedPeriod, showFallback && manualText.trim() ? manualText.trim() : undefined)}
          disabled={verificationLoading}
          className="w-full font-heading text-xs tracking-[2px] mb-2"
        >
          {verificationLoading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              ANALYZING {selectedPeriod}...
            </>
          ) : (
            <>VERIFY {selectedPeriod} WITH AI</>
          )}
        </Button>

        {/* Fallback Toggle */}
        <button
          onClick={() => setShowFallback(!showFallback)}
          className="text-[0.625rem] text-muted-foreground hover:text-white/60 font-heading tracking-[1px] mb-2"
        >
          {showFallback ? "\u25BC" : "\u25B6"} MANUAL FALLBACK
        </button>

        {showFallback && (
          <textarea
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder="Paste game summary text here if ESPN API is unavailable..."
            className="w-full h-24 bg-input border border-white/10 rounded-md p-2 text-xs text-white resize-y mb-2"
          />
        )}

        {/* Verification Results */}
        {verificationResult && (
          <div className="mt-3 border-t border-border pt-3">
            <div className="font-heading text-[0.625rem] tracking-[2px] text-muted-foreground mb-2">
              RESULTS — {verificationResult.period}
            </div>
            {verificationResult.status === "error" ? (
              <div className="text-destructive text-xs mb-2">
                {verificationResult.error || "Verification error"}
              </div>
            ) : (
              <div className="space-y-1 mb-3">
                {verificationResult.events.map((ev) => (
                  <div
                    key={ev.eventId}
                    className="flex items-center gap-2 py-1 px-2 rounded text-xs"
                    style={{
                      backgroundColor: ev.occurred ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.02)",
                    }}
                  >
                    <span className="text-base">
                      {ev.occurred ? "\u2705" : "\u274C"}
                    </span>
                    <span className="flex-1 text-white/80">{ev.eventName}</span>
                    <span className={`font-heading text-[0.5rem] tracking-[1px] ${
                      ev.confidence === "high" ? "text-accent-green" :
                      ev.confidence === "medium" ? "text-yellow-400" : "text-orange-400"
                    }`}>
                      {ev.confidence.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {verificationResult.summary && (
              <div className="text-[0.6875rem] text-muted-foreground mb-3 italic">
                {verificationResult.summary}
              </div>
            )}
            <div className="flex gap-2">
              <Button
                onClick={onApproveVerification}
                className="flex-1 font-heading text-xs tracking-[2px]"
                disabled={verificationResult.status === "error"}
              >
                APPROVE & APPLY
              </Button>
              <Button
                onClick={onDismissVerification}
                variant="outline"
                className="flex-1 font-heading text-xs tracking-[2px]"
              >
                DISMISS
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Event Toggles by Period */}
      {PERIODS_ORDER.map((period) => {
        const config = PERIOD_CONFIG[period];
        const events = EVENTS.filter((e) => e.period === period);
        return (
          <div key={period} className="mx-4 my-1.5">
            <div
              className="font-heading text-[0.6875rem] tracking-[2px] font-semibold py-1.5 pb-1"
              style={{ color: config.color }}
            >
              {config.label}
            </div>
            {events.map((ev) => (
              <AdminEventRow
                key={ev.id}
                event={ev}
                hit={!!eventState[ev.id]}
                onToggle={() => onToggleEvent(ev.id)}
              />
            ))}
          </div>
        );
      })}

      {/* Registered Players */}
      <div className="px-4 pt-6 pb-4">
        <div className="font-heading text-xs tracking-[3px] text-white/30 mb-2">
          REGISTERED PLAYERS ({players.length})
        </div>
        {players.length === 0 ? (
          <div className="text-center py-5 text-white/20 text-[0.8125rem]">
            No players registered yet.
          </div>
        ) : (
          players.map((p) => (
            <div
              key={p.name + p.ts}
              className="flex justify-between items-center py-2 px-2.5 border-b border-white/[0.04]"
            >
              <div>
                <span className="text-[0.8125rem] text-white">{p.name}</span>
                <span className="text-[0.6875rem] text-muted-foreground ml-2">{p.picks.length} picks</span>
                {p.tiebreaker && (
                  <span className="text-[0.6875rem] text-white/15 ml-2">({p.tiebreaker})</span>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-destructive/60 hover:text-destructive hover:bg-destructive/10 min-h-[2.75rem] min-w-[2.75rem]"
                onClick={() => setDeleteTarget(p.name)}
              >
                &times;
              </Button>
            </div>
          ))
        )}
      </div>

      {/* Reset Confirmation Dialog */}
      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset All Data"
        description="This will clear all players and events. This action cannot be undone."
        confirmLabel="Reset All"
        variant="destructive"
        onConfirm={onReset}
      />

      {/* Delete Player Confirmation Dialog */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Remove Player"
        description={`Remove "${deleteTarget}" from the game? This cannot be undone.`}
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={() => {
          if (deleteTarget) onRemovePlayer(deleteTarget);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
