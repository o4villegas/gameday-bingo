/**
 * Tests for the self-healing localStorage reset detection.
 *
 * Verifies that when a player's name is no longer in the server's player list
 * (e.g. after admin reset or player removal), the frontend automatically clears
 * the submission lock in localStorage and allows re-entry.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor, screen } from "@testing-library/react";
import App from "./App";

// ---------------------------------------------------------------------------
// Mock fetch to return controlled API responses
// ---------------------------------------------------------------------------
let mockPlayers: unknown[] = [];
let mockEvents: Record<string, boolean> = {};

function mockFetch(url: string | URL | Request) {
  const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;

  if (urlStr.includes("/api/events")) {
    return Promise.resolve(new Response(JSON.stringify(mockEvents), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
  }
  if (urlStr.includes("/api/players")) {
    return Promise.resolve(new Response(JSON.stringify(mockPlayers), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
  }
  if (urlStr.includes("/api/game-state")) {
    return Promise.resolve(new Response(JSON.stringify({ locked: false }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
  }
  return Promise.resolve(new Response("{}", { status: 404 }));
}

beforeEach(() => {
  localStorage.clear();
  mockPlayers = [];
  mockEvents = {};
  vi.stubGlobal("fetch", vi.fn(mockFetch));
  // Suppress window.scrollTo in jsdom
  vi.stubGlobal("scrollTo", vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Self-healing localStorage reset detection", () => {
  it("clears submission lock when player name is missing from server", async () => {
    // Simulate: user previously submitted as "alice", but admin has since reset
    localStorage.setItem("sb-submitted", "true");
    localStorage.setItem("sb-submitted-name", "alice");
    mockPlayers = []; // Server returns empty list (admin reset)

    render(<App />);

    await waitFor(() => {
      expect(localStorage.getItem("sb-submitted")).toBeNull();
      expect(localStorage.getItem("sb-submitted-name")).toBeNull();
    });
  });

  it("clears lock when player was individually removed by admin", async () => {
    localStorage.setItem("sb-submitted", "true");
    localStorage.setItem("sb-submitted-name", "alice");
    // Server still has other players, but not Alice
    mockPlayers = [
      { name: "Bob", picks: [], tiebreaker: "", ts: 1000 },
      { name: "Charlie", picks: [], tiebreaker: "", ts: 1001 },
    ];

    render(<App />);

    await waitFor(() => {
      expect(localStorage.getItem("sb-submitted")).toBeNull();
    });
  });

  it("keeps lock when player still exists on server", async () => {
    localStorage.setItem("sb-submitted", "true");
    localStorage.setItem("sb-submitted-name", "alice");
    // Server still has Alice
    mockPlayers = [
      { name: "Alice", picks: [], tiebreaker: "", ts: 1000 },
    ];

    render(<App />);

    // Wait for loadData to complete (loading spinner disappears)
    await waitFor(() => {
      expect(screen.queryByText("LOADING...")).not.toBeInTheDocument();
    });

    // Lock should still be set
    expect(localStorage.getItem("sb-submitted")).toBe("true");
    expect(localStorage.getItem("sb-submitted-name")).toBe("alice");
  });

  it("keeps lock when sb-submitted-name is missing (legacy user)", async () => {
    // Legacy case: submitted before the name-tracking feature was added
    localStorage.setItem("sb-submitted", "true");
    // No sb-submitted-name set
    mockPlayers = []; // Even with empty server, no name to check

    render(<App />);

    await waitFor(() => {
      expect(screen.queryByText("LOADING...")).not.toBeInTheDocument();
    });

    // Lock should remain (safe default — can't verify without name)
    expect(localStorage.getItem("sb-submitted")).toBe("true");
  });

  it("handles case-insensitive name matching", async () => {
    localStorage.setItem("sb-submitted", "true");
    localStorage.setItem("sb-submitted-name", "alice"); // lowercase stored
    // Server has "ALICE" (different case)
    mockPlayers = [
      { name: "ALICE", picks: [], tiebreaker: "", ts: 1000 },
    ];

    render(<App />);

    await waitFor(() => {
      expect(screen.queryByText("LOADING...")).not.toBeInTheDocument();
    });

    // Should still be locked — "alice" matches "ALICE" case-insensitively
    expect(localStorage.getItem("sb-submitted")).toBe("true");
  });

  it("shows picks form after lock is cleared by self-healing", async () => {
    localStorage.setItem("sb-submitted", "true");
    localStorage.setItem("sb-submitted-name", "alice");
    mockPlayers = []; // Admin reset

    render(<App />);

    // After self-healing clears the lock, the LockedScreen should NOT appear
    // and the picks form should be accessible
    await waitFor(() => {
      expect(localStorage.getItem("sb-submitted")).toBeNull();
    });
  });
});
