import { useState, useEffect, useCallback } from "react";

const EVENTS = [
  // Tier 4 - Totally Unlikely (<5%) - 50% off entire tab
  { id: "t4_punt_return_td", name: "Punt Return Touchdown", tier: 4 },
  { id: "t4_opening_kick_td", name: "Opening Kickoff Returned for TD", tier: 4 },
  { id: "t4_overtime", name: "Game Goes to Overtime", tier: 4 },
  { id: "t4_onside_kick", name: "Successful Onside Kick", tier: 4 },
  { id: "t4_blocked_ret_td", name: "Blocked Punt/FG Returned for TD", tier: 4 },
  { id: "t4_fake_fg", name: "Fake Field Goal Attempted", tier: 4 },
  { id: "t4_ejection", name: "Player Ejected", tier: 4 },
  // Tier 3 - Very Unlikely (<10%) - 20% off entire tab
  { id: "t3_non_qb_td_pass", name: "Non-QB Throws a TD Pass", tier: 3 },
  { id: "t3_blocked_punt", name: "Blocked Punt", tier: 3 },
  // Tier 2 - Unlikely (<20%) - Free YCI shell
  { id: "t2_blocked_fg", name: "Blocked Field Goal", tier: 2 },
  { id: "t2_fumble_ret_td", name: "Fumble Returned for TD", tier: 2 },
  { id: "t2_margin_7", name: "Final Margin Exactly 7 Points", tier: 2 },
  { id: "t2_margin_3", name: "Final Margin Exactly 3 Points", tier: 2 },
  { id: "t2_safety", name: "Safety Scored", tier: 2 },
  { id: "t2_missed_xp", name: "Missed Extra Point", tier: 2 },
  { id: "t2_kick_ret_td", name: "Kickoff Return Touchdown", tier: 2 },
  { id: "t2_gatorade_blue", name: "Gatorade Bath: Blue", tier: 2 },
  { id: "t2_gatorade_clear", name: "Gatorade Bath: Clear/Water", tier: 2 },
  { id: "t2_no_gatorade", name: "No Gatorade Bath Occurs", tier: 2 },
  { id: "t2_50yd_fg", name: "50+ Yard Field Goal Made", tier: 2 },
  // Tier 1 - Hard But Possible (<50%) - $3 YCI shells
  { id: "t1_qb_rush_td", name: "QB Rushes for Touchdown", tier: 1 },
  { id: "t1_gatorade_orange", name: "Gatorade Bath: Orange", tier: 1 },
  { id: "t1_low_loser", name: "Losing Team Scores ≤10", tier: 1 },
  { id: "t1_pick_six", name: "Pick-Six (INT Returned for TD)", tier: 1 },
  { id: "t1_60yd_td", name: "60+ Yard Offensive TD Play", tier: 1 },
  { id: "t1_failed_2pt", name: "Failed Two-Point Conversion", tier: 1 },
  { id: "t1_blowout", name: "Blowout (Margin 17+ Points)", tier: 1 },
  { id: "t1_low_scoring", name: "Neither Team Scores 25+", tier: 1 },
  { id: "t1_2pt_attempted", name: "Two-Point Conversion Attempted", tier: 1 },
  { id: "t1_missed_fg", name: "Missed Field Goal (Any)", tier: 1 },
];

const TIER_CONFIG = {
  4: { label: "TIER 4", subtitle: "Totally Unlikely", color: "#ff2d55", bg: "rgba(255,45,85,0.08)", border: "rgba(255,45,85,0.25)", prize: "50% OFF TAB", emoji: "🔥" },
  3: { label: "TIER 3", subtitle: "Very Unlikely", color: "#ff9500", bg: "rgba(255,149,0,0.08)", border: "rgba(255,149,0,0.25)", prize: "20% OFF TAB", emoji: "⚡" },
  2: { label: "TIER 2", subtitle: "Unlikely", color: "#5ac8fa", bg: "rgba(90,200,250,0.08)", border: "rgba(90,200,250,0.25)", prize: "FREE YCI SHELL", emoji: "🥥" },
  1: { label: "TIER 1", subtitle: "Hard But Possible", color: "#30d158", bg: "rgba(48,209,88,0.08)", border: "rgba(48,209,88,0.25)", prize: "$3 YCI SHELL", emoji: "🌿" },
};

const MAX_PICKS = 5;
const ADMIN_CODE = "kava60";
const TIERS_ORDER = [4, 3, 2, 1];

export default function SuperBowlGame() {
  const [tab, setTab] = useState("picks");
  const [playerName, setPlayerName] = useState("");
  const [tiebreaker, setTiebreaker] = useState("");
  const [selectedPicks, setSelectedPicks] = useState([]);
  const [players, setPlayers] = useState([]);
  const [eventState, setEventState] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [adminAuth, setAdminAuth] = useState(false);
  const [adminCode, setAdminCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [collapsedTiers, setCollapsedTiers] = useState({});

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadData = useCallback(async () => {
    try {
      let ev = {};
      let pl = [];
      try {
        const r = await window.storage.get("sb-events", true);
        if (r) ev = JSON.parse(r.value);
      } catch {}
      try {
        const r = await window.storage.get("sb-players", true);
        if (r) pl = JSON.parse(r.value);
      } catch {}
      setEventState(ev);
      setPlayers(pl);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (tab === "live" || tab === "admin" || tab === "prizes") {
      const interval = setInterval(loadData, 8000);
      return () => clearInterval(interval);
    }
  }, [tab, loadData]);

  const toggleTier = (tier) => {
    setCollapsedTiers(prev => ({ ...prev, [tier]: !prev[tier] }));
  };

  const togglePick = (id) => {
    setSelectedPicks(prev => {
      if (prev.includes(id)) return prev.filter(p => p !== id);
      if (prev.length >= MAX_PICKS) return prev;
      return [...prev, id];
    });
  };

  const submitPicks = async () => {
    if (!playerName.trim()) { showToast("Enter your name!", "error"); return; }
    if (selectedPicks.length !== MAX_PICKS) { showToast(`Select exactly ${MAX_PICKS} predictions!`, "error"); return; }

    const player = {
      name: playerName.trim(),
      picks: selectedPicks,
      tiebreaker: tiebreaker.trim(),
      ts: Date.now(),
    };

    try {
      let existing = [];
      try {
        const r = await window.storage.get("sb-players", true);
        if (r) existing = JSON.parse(r.value);
      } catch {}
      existing = existing.filter(p => p.name.toLowerCase() !== player.name.toLowerCase());
      existing.push(player);
      await window.storage.set("sb-players", JSON.stringify(existing), true);
      setPlayers(existing);
      setSubmitted(true);
      showToast("Picks locked in! 🏈");
      setTab("live");
    } catch {
      showToast("Error saving picks. Try again.", "error");
    }
  };

  const toggleEvent = async (id) => {
    const updated = { ...eventState, [id]: !eventState[id] };
    setEventState(updated);
    try {
      await window.storage.set("sb-events", JSON.stringify(updated), true);
    } catch {
      showToast("Error saving", "error");
    }
  };

  const resetGame = async () => {
    if (!confirm("Reset ALL data? This clears all players and events.")) return;
    try {
      await window.storage.set("sb-events", JSON.stringify({}), true);
      await window.storage.set("sb-players", JSON.stringify([]), true);
      setEventState({});
      setPlayers([]);
      showToast("Game reset!");
    } catch {}
  };

  const getPlayerPrizes = (player) => {
    let prizes = [];
    let tabDiscount = 0;
    let shells3 = 0;
    let freeShells = 0;

    player.picks.forEach(pickId => {
      if (eventState[pickId]) {
        const ev = EVENTS.find(e => e.id === pickId);
        if (!ev) return;
        if (ev.tier === 4) tabDiscount += 50;
        if (ev.tier === 3) tabDiscount += 20;
        if (ev.tier === 2) freeShells++;
        if (ev.tier === 1) shells3++;
      }
    });

    tabDiscount = Math.min(tabDiscount, 50);
    if (tabDiscount > 0) prizes.push(`${tabDiscount}% off tab`);
    if (freeShells > 0) prizes.push(`${freeShells} free YCI shell${freeShells > 1 ? "s" : ""}`);
    if (shells3 > 0) prizes.push(`${shells3}× $3 YCI shell${shells3 > 1 ? "s" : ""}`);

    const correctCount = player.picks.filter(p => eventState[p]).length;
    return { prizes, correctCount, tabDiscount, freeShells, shells3 };
  };

  const tierGroups = TIERS_ORDER.map(tier => ({
    tier,
    config: TIER_CONFIG[tier],
    events: EVENTS.filter(e => e.tier === tier),
  }));

  const totalHits = Object.values(eventState).filter(Boolean).length;

  if (loading) return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#0a0a0f", color: "#fff", fontFamily: "'Courier New', monospace", flexDirection: "column",
      textAlign: "center"
    }}>
      <div style={{ fontSize: 48, animation: "bounce 1s infinite" }}>🏈</div>
      <div style={{ marginTop: 12, letterSpacing: 4, fontSize: 12, opacity: 0.6 }}>LOADING...</div>
    </div>
  );

  const TAB_HEIGHT = 52;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#e8e4de", fontFamily: "'Georgia', 'Times New Roman', serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes slideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes toastIn { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
        .event-row { transition: all 0.2s ease; }
        .event-row:active { background: rgba(255,255,255,0.05); }
        .tab-btn { transition: all 0.15s ease; cursor: pointer; -webkit-tap-highlight-color: transparent; }
        .pick-btn { transition: all 0.15s ease; cursor: pointer; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent; }
        .pick-btn:active { transform: scale(0.98); }
        .tier-header { cursor: pointer; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent; }
        input { font-family: 'Source Serif 4', Georgia, serif; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }
      `}</style>

      {toast && (
        <div style={{
          position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 1000,
          background: toast.type === "error" ? "#ff2d55" : "#30d158", color: "#fff",
          padding: "10px 24px", borderRadius: 8, fontSize: 14, fontWeight: 600,
          fontFamily: "'Oswald', sans-serif", letterSpacing: 1, animation: "toastIn 0.3s ease",
          boxShadow: "0 4px 20px rgba(0,0,0,0.4)", maxWidth: "90vw", textAlign: "center"
        }}>{toast.msg}</div>
      )}

      {/* Header */}
      <div style={{
        background: "linear-gradient(180deg, #1a1520 0%, #0a0a0f 100%)",
        borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "20px 16px 12px", textAlign: "center"
      }}>
        <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 11, letterSpacing: 6, color: "#ff9500", marginBottom: 4, fontWeight: 500 }}>
          KAVA CULTURE PRESENTS
        </div>
        <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 28, fontWeight: 700, letterSpacing: 2, color: "#fff", lineHeight: 1.1 }}>
          SUPER BOWL LX
        </h1>
        <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 13, letterSpacing: 3, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
          HARD MODE PREDICTIONS
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "'Oswald', sans-serif", letterSpacing: 1 }}>
          {players.length} PLAYER{players.length !== 1 ? "S" : ""} REGISTERED
          {totalHits > 0 && <> · {totalHits} EVENT{totalHits !== 1 ? "S" : ""} HIT</>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex", background: "#0f0e14", borderBottom: "1px solid rgba(255,255,255,0.06)",
        position: "sticky", top: 0, zIndex: 100, height: TAB_HEIGHT
      }}>
        {[
          { id: "picks", label: "PICKS", icon: "✍️" },
          { id: "live", label: "LIVE", icon: "📡" },
          { id: "prizes", label: "PRIZES", icon: "🏆" },
          { id: "admin", label: "ADMIN", icon: "⚙️" },
        ].map(t => (
          <button key={t.id} className="tab-btn" onClick={() => setTab(t.id)} style={{
            flex: 1, padding: "10px 4px 8px", border: "none", background: "transparent",
            color: tab === t.id ? "#ff9500" : "rgba(255,255,255,0.35)",
            fontFamily: "'Oswald', sans-serif", fontSize: 11, letterSpacing: 2, fontWeight: 600,
            borderBottom: tab === t.id ? "2px solid #ff9500" : "2px solid transparent",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2
          }}>
            <span style={{ fontSize: 18 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "0 0 100px" }}>

        {/* ===== PICKS TAB ===== */}
        {tab === "picks" && (
          <div style={{ animation: "slideIn 0.3s ease" }}>
            {submitted ? (
              <div style={{ padding: "60px 24px", textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
                <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 22, color: "#30d158", letterSpacing: 2 }}>PICKS LOCKED IN</h2>
                <p style={{ marginTop: 12, color: "rgba(255,255,255,0.5)", fontSize: 14, lineHeight: 1.6 }}>
                  Head to the <span style={{ color: "#ff9500", cursor: "pointer", textDecoration: "underline" }} onClick={() => setTab("live")}>Live Board</span> to track events during the game.
                </p>
                <button onClick={() => { setSubmitted(false); setSelectedPicks([]); setPlayerName(""); setTiebreaker(""); }} style={{
                  marginTop: 24, padding: "10px 24px", background: "transparent", border: "1px solid rgba(255,255,255,0.15)",
                  color: "rgba(255,255,255,0.5)", borderRadius: 6, cursor: "pointer", fontFamily: "'Oswald', sans-serif",
                  fontSize: 12, letterSpacing: 2
                }}>SUBMIT NEW ENTRY</button>
              </div>
            ) : (
              <>
                <div style={{ padding: "20px 16px 0" }}>
                  <div style={{
                    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 10, padding: 16
                  }}>
                    <label style={{ fontFamily: "'Oswald', sans-serif", fontSize: 11, letterSpacing: 2, color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>YOUR NAME</label>
                    <input value={playerName} onChange={e => setPlayerName(e.target.value)} placeholder="Enter your name"
                      style={{
                        width: "100%", padding: "10px 12px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 6, color: "#fff", fontSize: 16, outline: "none"
                      }} />
                    <label style={{ fontFamily: "'Oswald', sans-serif", fontSize: 11, letterSpacing: 2, color: "rgba(255,255,255,0.4)", display: "block", marginTop: 14, marginBottom: 6 }}>
                      TIEBREAKER: PREDICT FINAL SCORE
                    </label>
                    <input value={tiebreaker} onChange={e => setTiebreaker(e.target.value)} placeholder="e.g. Chiefs 27, Eagles 24"
                      style={{
                        width: "100%", padding: "10px 12px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 6, color: "#fff", fontSize: 16, outline: "none"
                      }} />
                  </div>
                </div>

                {/* Pick Counter */}
                <div style={{
                  padding: "12px 16px 8px", position: "sticky", top: TAB_HEIGHT, zIndex: 50,
                  background: "#0a0a0f"
                }}>
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    background: selectedPicks.length === MAX_PICKS ? "rgba(48,209,88,0.1)" : "rgba(255,149,0,0.1)",
                    border: `1px solid ${selectedPicks.length === MAX_PICKS ? "rgba(48,209,88,0.3)" : "rgba(255,149,0,0.3)"}`,
                    borderRadius: 8, padding: "10px 14px", transition: "all 0.3s ease"
                  }}>
                    <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 13, letterSpacing: 2, color: selectedPicks.length === MAX_PICKS ? "#30d158" : "#ff9500" }}>
                      {selectedPicks.length === MAX_PICKS ? "✅ READY TO SUBMIT" : `SELECT ${MAX_PICKS - selectedPicks.length} MORE`}
                    </span>
                    <span style={{
                      fontFamily: "'Oswald', sans-serif", fontSize: 20, fontWeight: 700,
                      color: selectedPicks.length === MAX_PICKS ? "#30d158" : "#ff9500"
                    }}>
                      {selectedPicks.length}/{MAX_PICKS}
                    </span>
                  </div>
                </div>

                {/* Events by Tier — all expanded by default */}
                {tierGroups.map(({ tier, config, events }) => {
                  const isCollapsed = collapsedTiers[tier] === true;
                  const pickedInTier = selectedPicks.filter(p => events.some(e => e.id === p)).length;
                  return (
                    <div key={tier} style={{ margin: "8px 16px" }}>
                      <div className="tier-header" onClick={() => toggleTier(tier)} style={{
                        background: config.bg, border: `1px solid ${config.border}`, borderRadius: 8,
                        padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between"
                      }}>
                        <div>
                          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 14, fontWeight: 700, color: config.color, letterSpacing: 2 }}>
                            {config.emoji} {config.label}
                          </div>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                            {config.subtitle} — <span style={{ color: config.color }}>{config.prize}</span>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {pickedInTier > 0 && (
                            <span style={{
                              background: config.color, color: "#000", borderRadius: 10,
                              padding: "2px 8px", fontSize: 11, fontFamily: "'Oswald', sans-serif", fontWeight: 700
                            }}>
                              {pickedInTier}
                            </span>
                          )}
                          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 18, transition: "transform 0.2s", transform: isCollapsed ? "rotate(0deg)" : "rotate(180deg)" }}>▾</span>
                        </div>
                      </div>

                      {!isCollapsed && (
                        <div style={{ marginTop: 4 }}>
                          {events.map(ev => {
                            const picked = selectedPicks.includes(ev.id);
                            const disabled = !picked && selectedPicks.length >= MAX_PICKS;
                            return (
                              <div key={ev.id} className="pick-btn" onClick={() => !disabled && togglePick(ev.id)} style={{
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)",
                                opacity: disabled ? 0.35 : 1, cursor: disabled ? "not-allowed" : "pointer",
                                background: picked ? config.bg : "transparent"
                              }}>
                                <div style={{ flex: 1, fontSize: 14, color: picked ? config.color : "#e8e4de", fontWeight: picked ? 600 : 400 }}>
                                  {ev.name}
                                </div>
                                <div style={{
                                  width: 28, height: 28, borderRadius: 6, flexShrink: 0, marginLeft: 12,
                                  border: `2px solid ${picked ? config.color : "rgba(255,255,255,0.15)"}`,
                                  background: picked ? config.color : "transparent",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  fontSize: 14, color: "#000", fontWeight: 700, transition: "all 0.15s ease"
                                }}>
                                  {picked && "✓"}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                <div style={{ padding: "24px 16px" }}>
                  <button onClick={submitPicks} disabled={selectedPicks.length !== MAX_PICKS || !playerName.trim()} style={{
                    width: "100%", padding: "16px", border: "none", borderRadius: 10, cursor: "pointer",
                    fontFamily: "'Oswald', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: 3,
                    background: selectedPicks.length === MAX_PICKS && playerName.trim() ? "linear-gradient(135deg, #ff9500, #ff2d55)" : "rgba(255,255,255,0.06)",
                    color: selectedPicks.length === MAX_PICKS && playerName.trim() ? "#fff" : "rgba(255,255,255,0.2)",
                    transition: "all 0.3s ease"
                  }}>
                    🔒 LOCK IN PICKS
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ===== LIVE BOARD ===== */}
        {tab === "live" && (
          <div style={{ animation: "slideIn 0.3s ease" }}>
            <div style={{ padding: "14px 16px 4px", textAlign: "center" }}>
              <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 11, letterSpacing: 3, color: "rgba(255,255,255,0.3)" }}>
                📡 AUTO-REFRESHING
              </div>
              {totalHits > 0 && (
                <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 18, fontWeight: 700, color: "#30d158", marginTop: 6 }}>
                  {totalHits} EVENT{totalHits !== 1 ? "S" : ""} HIT
                </div>
              )}
            </div>

            {tierGroups.map(({ tier, config, events }) => {
              const hitCount = events.filter(e => eventState[e.id]).length;
              return (
                <div key={tier} style={{ margin: "10px 16px" }}>
                  <div style={{
                    fontFamily: "'Oswald', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: 2,
                    color: config.color, padding: "8px 0 4px", borderBottom: `1px solid ${config.border}`,
                    marginBottom: 4, display: "flex", justifyContent: "space-between", alignItems: "center"
                  }}>
                    <span>{config.emoji} {config.label} — {config.prize}</span>
                    {hitCount > 0 && (
                      <span style={{
                        background: "#30d158", color: "#000", borderRadius: 10,
                        padding: "1px 8px", fontSize: 10, fontWeight: 700
                      }}>
                        {hitCount} HIT
                      </span>
                    )}
                  </div>
                  {events.map(ev => {
                    const hit = eventState[ev.id];
                    return (
                      <div key={ev.id} className="event-row" style={{
                        display: "flex", alignItems: "center", padding: "10px 8px",
                        borderBottom: "1px solid rgba(255,255,255,0.03)",
                        background: hit ? "rgba(48,209,88,0.08)" : "transparent"
                      }}>
                        <div style={{
                          width: 24, height: 24, borderRadius: "50%", marginRight: 10, flexShrink: 0,
                          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12,
                          background: hit ? "#30d158" : "rgba(255,255,255,0.06)",
                          color: hit ? "#000" : "rgba(255,255,255,0.2)", fontWeight: 700,
                          transition: "all 0.3s ease"
                        }}>
                          {hit ? "✓" : "·"}
                        </div>
                        <div style={{
                          flex: 1, fontSize: 14,
                          color: hit ? "#30d158" : "#e8e4de",
                          fontWeight: hit ? 600 : 400,
                          transition: "all 0.3s ease"
                        }}>
                          {ev.name}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* ===== PRIZES TAB ===== */}
        {tab === "prizes" && (
          <div style={{ animation: "slideIn 0.3s ease" }}>
            <div style={{ padding: "20px 16px 8px" }}>
              <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 12, letterSpacing: 3, color: "rgba(255,255,255,0.3)", marginBottom: 12, textAlign: "center" }}>HOW PRIZES WORK</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {TIERS_ORDER.map(t => (
                  <div key={t} style={{
                    background: TIER_CONFIG[t].bg, border: `1px solid ${TIER_CONFIG[t].border}`,
                    borderRadius: 8, padding: "10px 12px", textAlign: "center"
                  }}>
                    <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 11, letterSpacing: 2, color: TIER_CONFIG[t].color, fontWeight: 700 }}>
                      {TIER_CONFIG[t].emoji} {TIER_CONFIG[t].label}
                    </div>
                    <div style={{ fontSize: 12, color: "#fff", marginTop: 4, fontWeight: 600 }}>
                      {TIER_CONFIG[t].prize}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", textAlign: "center", marginTop: 8, fontFamily: "'Oswald', sans-serif", letterSpacing: 1 }}>
                5 PICKS · PRIZES STACK · MAX 50% OFF TAB
              </div>
            </div>

            <div style={{ padding: "12px 16px" }}>
              <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 12, letterSpacing: 3, color: "rgba(255,255,255,0.3)", marginBottom: 12, textAlign: "center" }}>
                🏆 LEADERBOARD
              </div>
              {players.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,0.25)", fontSize: 14 }}>
                  No players yet. Be the first!
                </div>
              ) : (
                [...players]
                  .map(p => ({ ...p, ...getPlayerPrizes(p) }))
                  .sort((a, b) => b.correctCount - a.correctCount || a.ts - b.ts)
                  .map((player, i) => (
                    <div key={player.name + player.ts} style={{
                      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 8, padding: "12px 14px", marginBottom: 8
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 15, fontWeight: 600, color: "#fff", letterSpacing: 1 }}>
                          {i === 0 && player.correctCount > 0 ? "👑 " : ""}{player.name}
                        </span>
                        <span style={{
                          fontFamily: "'Oswald', sans-serif", fontSize: 20, fontWeight: 700,
                          color: player.correctCount > 0 ? "#30d158" : "rgba(255,255,255,0.2)"
                        }}>
                          {player.correctCount}/{MAX_PICKS}
                        </span>
                      </div>
                      <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {player.picks.map(pickId => {
                          const ev = EVENTS.find(e => e.id === pickId);
                          if (!ev) return null;
                          const hit = eventState[pickId];
                          return (
                            <span key={pickId} style={{
                              fontSize: 10, padding: "3px 8px", borderRadius: 4,
                              fontFamily: "'Oswald', sans-serif", letterSpacing: 1,
                              background: hit ? "rgba(48,209,88,0.2)" : "rgba(255,255,255,0.05)",
                              color: hit ? "#30d158" : "rgba(255,255,255,0.4)",
                              border: `1px solid ${hit ? "rgba(48,209,88,0.3)" : "rgba(255,255,255,0.08)"}`
                            }}>
                              {hit ? "✓ " : ""}{ev.name}
                            </span>
                          );
                        })}
                      </div>
                      {player.prizes.length > 0 ? (
                        <div style={{ marginTop: 8, fontSize: 13, color: "#ff9500", fontWeight: 600 }}>
                          🎉 {player.prizes.join(" + ")}
                        </div>
                      ) : (
                        <div style={{ marginTop: 8, fontSize: 12, color: "rgba(255,255,255,0.2)", fontFamily: "'Oswald', sans-serif", letterSpacing: 1 }}>
                          NO PRIZES YET
                        </div>
                      )}
                      {player.tiebreaker && (
                        <div style={{ marginTop: 4, fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "'Oswald', sans-serif", letterSpacing: 1 }}>
                          TIEBREAKER: {player.tiebreaker}
                        </div>
                      )}
                    </div>
                  ))
              )}
            </div>
          </div>
        )}

        {/* ===== ADMIN TAB ===== */}
        {tab === "admin" && (
          <div style={{ animation: "slideIn 0.3s ease" }}>
            {!adminAuth ? (
              <div style={{ padding: "60px 24px", textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🔐</div>
                <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 12, letterSpacing: 3, color: "rgba(255,255,255,0.4)", marginBottom: 16 }}>ADMIN ACCESS</div>
                <input value={adminCode} onChange={e => setAdminCode(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && adminCode === ADMIN_CODE) setAdminAuth(true); else if (e.key === "Enter") showToast("Wrong code", "error"); }}
                  type="password" placeholder="Enter code"
                  style={{
                    padding: "10px 16px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 6, color: "#fff", fontSize: 16, textAlign: "center", outline: "none", width: 200
                  }} />
                <div style={{ marginTop: 12 }}>
                  <button onClick={() => { if (adminCode === ADMIN_CODE) setAdminAuth(true); else showToast("Wrong code", "error"); }}
                    style={{
                      padding: "8px 24px", background: "#ff9500", border: "none", borderRadius: 6,
                      color: "#000", fontFamily: "'Oswald', sans-serif", fontSize: 13, letterSpacing: 2,
                      fontWeight: 700, cursor: "pointer"
                    }}>ENTER</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ padding: "16px 16px 4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 12, letterSpacing: 3, color: "#ff9500" }}>
                    ⚙️ EVENT CONTROLS
                  </div>
                  <button onClick={resetGame} style={{
                    padding: "4px 12px", background: "rgba(255,45,85,0.15)", border: "1px solid rgba(255,45,85,0.3)",
                    borderRadius: 4, color: "#ff2d55", fontSize: 10, fontFamily: "'Oswald', sans-serif",
                    letterSpacing: 2, cursor: "pointer"
                  }}>RESET ALL</button>
                </div>
                <div style={{ padding: "4px 16px 4px", marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                    Toggle events as they happen. Changes are live for all viewers.
                  </div>
                </div>
                {tierGroups.map(({ tier, config, events }) => (
                  <div key={tier} style={{ margin: "6px 16px" }}>
                    <div style={{
                      fontFamily: "'Oswald', sans-serif", fontSize: 11, letterSpacing: 2,
                      color: config.color, padding: "6px 0 4px", fontWeight: 600
                    }}>
                      {config.label}
                    </div>
                    {events.map(ev => {
                      const hit = eventState[ev.id];
                      return (
                        <div key={ev.id} className="pick-btn" onClick={() => toggleEvent(ev.id)} style={{
                          display: "flex", alignItems: "center", padding: "10px 8px",
                          borderBottom: "1px solid rgba(255,255,255,0.04)",
                          background: hit ? "rgba(48,209,88,0.1)" : "transparent"
                        }}>
                          <div style={{
                            width: 40, height: 24, borderRadius: 12, marginRight: 10, flexShrink: 0,
                            background: hit ? "#30d158" : "rgba(255,255,255,0.08)",
                            display: "flex", alignItems: "center", justifyContent: hit ? "flex-end" : "flex-start",
                            padding: "2px", transition: "all 0.2s ease"
                          }}>
                            <div style={{
                              width: 20, height: 20, borderRadius: "50%",
                              background: hit ? "#fff" : "rgba(255,255,255,0.2)",
                              transition: "all 0.2s ease"
                            }} />
                          </div>
                          <div style={{ fontSize: 13, color: hit ? "#30d158" : "#e8e4de" }}>
                            {ev.name}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}

                <div style={{ padding: "24px 16px" }}>
                  <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 12, letterSpacing: 3, color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>
                    REGISTERED PLAYERS ({players.length})
                  </div>
                  {players.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "20px 0", color: "rgba(255,255,255,0.2)", fontSize: 13 }}>
                      No players registered yet.
                    </div>
                  ) : players.map(p => (
                    <div key={p.name + p.ts} style={{
                      padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.04)",
                      display: "flex", justifyContent: "space-between", alignItems: "center"
                    }}>
                      <div>
                        <span style={{ fontSize: 13, color: "#fff" }}>{p.name}</span>
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginLeft: 8 }}>
                          {p.picks.length} picks
                        </span>
                        {p.tiebreaker && (
                          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.15)", marginLeft: 8 }}>
                            ({p.tiebreaker})
                          </span>
                        )}
                      </div>
                      <button onClick={async () => {
                        const updated = players.filter(pl => pl.name !== p.name || pl.ts !== p.ts);
                        setPlayers(updated);
                        await window.storage.set("sb-players", JSON.stringify(updated), true);
                        showToast(`Removed ${p.name}`);
                      }} style={{
                        background: "none", border: "none", color: "rgba(255,45,85,0.6)",
                        cursor: "pointer", fontSize: 18, padding: "4px 8px"
                      }}>×</button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
