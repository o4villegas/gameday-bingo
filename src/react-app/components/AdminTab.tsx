import { useState } from "react";
import { toast } from "sonner";
import type { EventState, Player } from "../../shared/types";
import { EVENTS, TIERS_ORDER, TIER_CONFIG } from "../../shared/constants";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
}

export function AdminTab({
  adminAuth,
  eventState,
  players,
  onAdminAuth,
  onToggleEvent,
  onRemovePlayer,
  onReset,
}: AdminTabProps) {
  const [codeInput, setCodeInput] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

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

      {/* Event Toggles by Tier */}
      {TIERS_ORDER.map((tier) => {
        const config = TIER_CONFIG[tier];
        const events = EVENTS.filter((e) => e.tier === tier);
        return (
          <div key={tier} className="mx-4 my-1.5">
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
