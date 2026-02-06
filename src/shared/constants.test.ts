import { describe, it, expect } from "vitest";
import { EVENTS, PERIOD_CONFIG, MAX_PICKS, MAX_PICKS_PER_PERIOD, PERIODS_ORDER } from "./constants";
import type { Period } from "./types";

describe("EVENTS", () => {
  it("has exactly 50 events total", () => {
    expect(EVENTS).toHaveLength(50);
  });

  it("has 10 Q1 events", () => {
    expect(EVENTS.filter((e) => e.period === "Q1")).toHaveLength(10);
  });

  it("has 10 Q2 events", () => {
    expect(EVENTS.filter((e) => e.period === "Q2")).toHaveLength(10);
  });

  it("has 10 Q3 events", () => {
    expect(EVENTS.filter((e) => e.period === "Q3")).toHaveLength(10);
  });

  it("has 10 Q4 events", () => {
    expect(EVENTS.filter((e) => e.period === "Q4")).toHaveLength(10);
  });

  it("has 10 FG events", () => {
    expect(EVENTS.filter((e) => e.period === "FG")).toHaveLength(10);
  });

  it("has unique IDs for every event", () => {
    const ids = EVENTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all events have non-empty names", () => {
    for (const event of EVENTS) {
      expect(event.name.trim().length).toBeGreaterThan(0);
    }
  });

  it("all events have valid period values", () => {
    const validPeriods: Period[] = ["Q1", "Q2", "Q3", "Q4", "FG"];
    for (const event of EVENTS) {
      expect(validPeriods).toContain(event.period);
    }
  });

  it("all event IDs follow the period prefix convention", () => {
    const prefixMap: Record<Period, string> = {
      Q1: "q1_",
      Q2: "q2_",
      Q3: "q3_",
      Q4: "q4_",
      FG: "fg_",
    };
    for (const event of EVENTS) {
      expect(event.id.startsWith(prefixMap[event.period])).toBe(true);
    }
  });
});

describe("PERIOD_CONFIG", () => {
  it("has configuration for all 5 periods", () => {
    for (const period of ["Q1", "Q2", "Q3", "Q4", "FG"] as Period[]) {
      expect(PERIOD_CONFIG[period]).toBeDefined();
    }
  });

  it("each period has all required fields", () => {
    for (const period of ["Q1", "Q2", "Q3", "Q4", "FG"] as Period[]) {
      const config = PERIOD_CONFIG[period];
      expect(config.label).toBeTruthy();
      expect(config.subtitle).toBeTruthy();
      expect(config.color).toMatch(/^#/);
      expect(config.bg).toMatch(/^rgba/);
      expect(config.border).toMatch(/^rgba/);
      expect(config.emoji).toBeTruthy();
    }
  });
});

describe("Game constants", () => {
  it("MAX_PICKS is 10", () => {
    expect(MAX_PICKS).toBe(10);
  });

  it("MAX_PICKS_PER_PERIOD is 2", () => {
    expect(MAX_PICKS_PER_PERIOD).toBe(2);
  });

  it("PERIODS_ORDER is [Q1, Q2, Q3, Q4, FG]", () => {
    expect([...PERIODS_ORDER]).toEqual(["Q1", "Q2", "Q3", "Q4", "FG"]);
  });

  it("MAX_PICKS equals MAX_PICKS_PER_PERIOD * number of periods", () => {
    expect(MAX_PICKS).toBe(MAX_PICKS_PER_PERIOD * PERIODS_ORDER.length);
  });
});
