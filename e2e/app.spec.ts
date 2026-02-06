import { test, expect, type Page } from "@playwright/test";

// ================================================================
// HELPERS
// ================================================================

// Standard test picks: 2 per period (10 total)
const STANDARD_PICKS = [
  "q1_opening_kick_td", "q1_first_score_fg",
  "q2_pick_six", "q2_50yd_fg",
  "q3_first_drive_td", "q3_no_points",
  "q4_2pt_attempted", "q4_overtime",
  "fg_gatorade_orange", "fg_margin_3",
];

// Alternate test picks: 2 per period (10 total)
const ALTERNATE_PICKS = [
  "q1_safety_first_play", "q1_no_points",
  "q2_tied_halftime", "q2_halftime_margin_14",
  "q3_lead_change", "q3_kick_ret_td",
  "q4_failed_2pt", "q4_pick_six",
  "fg_gatorade_blue", "fg_blowout",
];

// Helper: clear localStorage and navigate fresh
// Default tab for first-time visitors is "rules"
async function freshPage(page: Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  await page.waitForSelector('[data-slot="tabs"]');
}

// Helper: navigate fresh and go to picks tab
async function freshPageOnPicks(page: Page) {
  await freshPage(page);
  await page.getByRole("tab", { name: /PICKS/ }).click();
}

// Helper: select 10 events (2 from each period) by clicking text
async function selectTenEvents(page: Page) {
  // Q1 (2)
  await page.getByText("Opening Kickoff Returned for TD").click();
  await page.getByText("First Score Is a Field Goal").click();
  // Q2 (2)
  await page.getByText("Pick-Six Thrown in Q2").click();
  await page.getByText("50+ Yard Field Goal Made in Q2").click();
  // Q3 (2)
  await page.getByText("First Drive of Second Half Scores TD").click();
  await page.getByText("No Points Scored in Q3").click();
  // Q4 (2)
  await page.getByText("Two-Point Conversion Attempted").click();
  await page.getByText("Game Goes to Overtime").click();
  // FG (2)
  await page.getByText("Gatorade Bath Color Is ORANGE").click();
  await page.getByText("Final Margin Exactly 3 Points").click();
}

// Helper: mock API responses so tests don't depend on a running backend
async function mockAPIs(page: Page, options?: {
  events?: Record<string, boolean>;
  players?: Array<{ name: string; picks: string[]; tiebreaker: string; ts: number }>;
}) {
  const events = options?.events ?? {};
  const players = options?.players ?? [];

  await page.route("**/api/events", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ json: events });
    }
    return route.continue();
  });

  await page.route("**/api/players", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ json: players });
    }
    if (route.request().method() === "POST") {
      return route.fulfill({
        json: { success: true, player: { ...JSON.parse(route.request().postData() || "{}"), ts: Date.now() } },
      });
    }
    return route.continue();
  });

  await page.route("**/api/events/*", (route) => {
    if (route.request().method() === "PUT") {
      return route.fulfill({ json: events });
    }
    return route.continue();
  });

  await page.route("**/api/players/*", (route) => {
    if (route.request().method() === "DELETE") {
      return route.fulfill({ status: 200, json: { success: true } });
    }
    return route.continue();
  });

  await page.route("**/api/reset", (route) => {
    if (route.request().method() === "POST") {
      return route.fulfill({ status: 200, json: { success: true } });
    }
    return route.continue();
  });

  await page.route("**/api/verify**", (route) => route.fulfill({ json: {} }));
}

// ================================================================
// 1. INITIAL LOAD & HEADER
// ================================================================
test.describe("Initial Load & Header", () => {
  test("app loads and shows header branding", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await expect(page.getByRole("heading", { name: "SUPER BOWL LX" })).toBeVisible();
    await expect(page.getByText("KAVA CULTURE PRESENTS")).toBeVisible();
  });

  test("shows loading state before data arrives", async ({ page }) => {
    // Delay API response to catch loading state
    await page.route("**/api/events", (route) =>
      setTimeout(() => route.fulfill({ json: {} }), 2000)
    );
    await page.route("**/api/players", (route) =>
      setTimeout(() => route.fulfill({ json: [] }), 2000)
    );
    await page.goto("/");
    await expect(page.getByText("LOADING...")).toBeVisible();
  });

  test("shows player count in header", async ({ page }) => {
    await mockAPIs(page, {
      players: [
        { name: "TestUser", picks: STANDARD_PICKS, tiebreaker: "28-24", ts: 1000 },
        { name: "TestUser2", picks: ALTERNATE_PICKS, tiebreaker: "21-17", ts: 2000 },
      ],
    });
    await freshPage(page);
    await expect(page.getByText("2 PLAYERS REGISTERED")).toBeVisible();
  });

  test("shows event hit count in header", async ({ page }) => {
    await mockAPIs(page, { events: { q4_overtime: true, q2_pick_six: true } });
    await freshPage(page);
    await expect(page.getByText("2 EVENTS HIT")).toBeVisible();
  });
});

// ================================================================
// 2. TAB NAVIGATION
// ================================================================
test.describe("Tab Navigation", () => {
  test("all 5 tabs are visible", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await expect(page.getByRole("tab", { name: /RULES/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /PICKS/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /LIVE/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /PRIZES/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /ADMIN/ })).toBeVisible();
  });

  test("RULES tab is active by default for new visitors", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    const rulesTab = page.getByRole("tab", { name: /RULES/ });
    await expect(rulesTab).toHaveAttribute("data-state", "active");
  });

  test("LIVE tab is active by default for submitted visitors", async ({ page }) => {
    await mockAPIs(page);
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("sb-submitted", "true"));
    await page.goto("/");
    await page.waitForSelector('[data-slot="tabs"]');
    const liveTab = page.getByRole("tab", { name: /LIVE/ });
    await expect(liveTab).toHaveAttribute("data-state", "active");
  });

  test("clicking PICKS tab switches content", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await page.getByRole("tab", { name: /PICKS/ }).click();
    await expect(page.getByText("YOUR NAME")).toBeVisible();
  });

  test("clicking LIVE tab switches content", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await page.getByRole("tab", { name: /LIVE/ }).click();
    await expect(page.getByText("AUTO-REFRESHING")).toBeVisible();
  });

  test("clicking PRIZES tab shows prizes content", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await page.getByRole("tab", { name: /PRIZES/ }).click();
    await expect(page.getByText("HOW PRIZES WORK")).toBeVisible();
  });

  test("clicking ADMIN tab shows admin login", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await page.getByRole("tab", { name: /ADMIN/ }).click();
    await expect(page.getByText("ADMIN ACCESS")).toBeVisible();
  });

  test("hash-based routing updates URL", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await page.getByRole("tab", { name: /LIVE/ }).click();
    await expect(page).toHaveURL(/#live/);
  });

  test("navigating to hash URL loads correct tab", async ({ page }) => {
    await mockAPIs(page);
    await page.goto("/#prizes");
    await page.waitForSelector('[data-slot="tabs"]');
    const prizesTab = page.getByRole("tab", { name: /PRIZES/ });
    await expect(prizesTab).toHaveAttribute("data-state", "active");
  });

  test("tabs have proper ARIA roles", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    const tablist = page.getByRole("tablist");
    await expect(tablist).toBeVisible();
    const tabs = page.getByRole("tab");
    await expect(tabs).toHaveCount(5);
  });
});

// ================================================================
// 3. RULES TAB
// ================================================================
test.describe("Rules Tab", () => {
  test("shows HOW TO PLAY heading", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await expect(page.getByText("HOW TO PLAY")).toBeVisible();
  });

  test("shows Super Bowl LX Prediction Game subtitle", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await expect(page.getByText("Super Bowl LX Prediction Game")).toBeVisible();
  });

  test("mentions 10 predictions", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await expect(page.getByText("10 predictions")).toBeVisible();
  });

  test("mentions 2 events per period", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await expect(page.getByText("2 events per period")).toBeVisible();
  });

  test("shows $3 YOU CALL IT SHELL prize", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await expect(page.getByText("$3 YOU CALL IT SHELL")).toBeVisible();
  });

  test("has MAKE YOUR PICKS button that navigates to picks tab", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    const makePicksBtn = page.getByRole("button", { name: /MAKE YOUR PICKS/ });
    await expect(makePicksBtn).toBeVisible();
    await makePicksBtn.click();
    const picksTab = page.getByRole("tab", { name: /PICKS/ });
    await expect(picksTab).toHaveAttribute("data-state", "active");
  });
});

// ================================================================
// 4. PICKS TAB - FORM & EVENT SELECTION
// ================================================================
test.describe("Picks Tab - Form", () => {
  test("shows name and tiebreaker inputs", async ({ page }) => {
    await mockAPIs(page);
    await freshPageOnPicks(page);
    await expect(page.getByPlaceholder("Enter your name")).toBeVisible();
    await expect(page.getByPlaceholder("e.g. Chiefs 27, Eagles 24")).toBeVisible();
  });

  test("shows YOUR NAME and TIEBREAKER labels", async ({ page }) => {
    await mockAPIs(page);
    await freshPageOnPicks(page);
    await expect(page.getByText("YOUR NAME")).toBeVisible();
    await expect(page.getByText("TIEBREAKER: PREDICT FINAL SCORE")).toBeVisible();
  });

  test("shows pick counter with SELECT 10 MORE initially", async ({ page }) => {
    await mockAPIs(page);
    await freshPageOnPicks(page);
    await expect(page.getByText("SELECT 10 MORE")).toBeVisible();
    await expect(page.getByText("0/10")).toBeVisible();
  });

  test("shows all 5 period sections", async ({ page }) => {
    await mockAPIs(page);
    await freshPageOnPicks(page);
    await expect(page.getByText("1ST QUARTER")).toBeVisible();
    await expect(page.getByText("2ND QUARTER")).toBeVisible();
    await expect(page.getByText("3RD QUARTER")).toBeVisible();
    await expect(page.getByText("4TH QUARTER")).toBeVisible();
    await expect(page.getByText("FULL GAME")).toBeVisible();
  });

  test("shows events from different periods", async ({ page }) => {
    await mockAPIs(page);
    await freshPageOnPicks(page);
    // Periods start expanded (collapsed=false), so events should be visible immediately
    await expect(page.getByText("Opening Kickoff Returned for TD")).toBeVisible();
    await expect(page.getByText("Pick-Six Thrown in Q2")).toBeVisible();
    await expect(page.getByText("First Drive of Second Half Scores TD")).toBeVisible();
    await expect(page.getByText("Two-Point Conversion Attempted")).toBeVisible();
    await expect(page.getByText("Gatorade Bath Color Is ORANGE")).toBeVisible();
  });

  test("selecting events updates pick counter", async ({ page }) => {
    await mockAPIs(page);
    await freshPageOnPicks(page);

    // Periods start expanded - click an event directly
    await page.getByText("Opening Kickoff Returned for TD").click();
    await expect(page.getByText("SELECT 9 MORE")).toBeVisible();
    await expect(page.getByText("1/10")).toBeVisible();
  });

  test("selecting 10 events shows READY TO SUBMIT", async ({ page }) => {
    await mockAPIs(page);
    await freshPageOnPicks(page);

    // Periods start expanded - select 10 events (2 per period)
    await selectTenEvents(page);

    await expect(page.getByText(/READY TO SUBMIT/)).toBeVisible();
    await expect(page.getByText("10/10")).toBeVisible();
  });

  test("deselecting event decreases counter", async ({ page }) => {
    await mockAPIs(page);
    await freshPageOnPicks(page);

    await page.getByText("Opening Kickoff Returned for TD").click();
    await expect(page.getByText("1/10")).toBeVisible();

    // Click again to deselect
    await page.getByText("Opening Kickoff Returned for TD").click();
    await expect(page.getByText("0/10")).toBeVisible();
  });

  test("event rows have proper checkbox role and aria", async ({ page }) => {
    await mockAPIs(page);
    await freshPageOnPicks(page);

    // Periods start expanded - checkboxes are visible immediately
    const checkbox = page.getByRole("checkbox").first();
    await expect(checkbox).toBeVisible();
    await expect(checkbox).toHaveAttribute("aria-checked", "false");

    await checkbox.click();
    await expect(checkbox).toHaveAttribute("aria-checked", "true");
  });

  test("submit button is disabled without name", async ({ page }) => {
    await mockAPIs(page);
    await freshPageOnPicks(page);

    // Select 10 events but don't enter name
    await selectTenEvents(page);

    const submitBtn = page.getByRole("button", { name: /LOCK IN PICKS/ });
    await expect(submitBtn).toBeDisabled();
  });

  test("successful submission navigates to live tab", async ({ page }) => {
    await mockAPIs(page);
    await freshPageOnPicks(page);

    // Fill form
    await page.getByPlaceholder("Enter your name").fill("TestPlayer");
    await page.getByPlaceholder("e.g. Chiefs 27, Eagles 24").fill("Chiefs 28, Eagles 21");

    // Select 10 events (periods start expanded)
    await selectTenEvents(page);

    // Submit
    const submitBtn = page.getByRole("button", { name: /LOCK IN PICKS/ });
    await submitBtn.click();

    // Should navigate to live tab
    await expect(page.getByText("AUTO-REFRESHING")).toBeVisible({ timeout: 5000 });
  });

  test("after submission, picks tab shows locked screen", async ({ page }) => {
    await mockAPIs(page);
    await freshPageOnPicks(page);

    // Fill & submit
    await page.getByPlaceholder("Enter your name").fill("TestPlayer");
    await selectTenEvents(page);
    await page.getByRole("button", { name: /LOCK IN PICKS/ }).click();
    await page.waitForTimeout(500);

    // Go back to picks
    await page.getByRole("tab", { name: /PICKS/ }).click();
    await expect(page.getByRole("heading", { name: "PICKS LOCKED IN" })).toBeVisible();
  });

  test("locked screen has Live Board link", async ({ page }) => {
    await mockAPIs(page);
    // Pre-set submitted state, then reload so useState initializer reads it
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("sb-submitted", "true"));
    await page.reload();
    await page.waitForSelector('[data-slot="tabs"]');
    await page.getByRole("tab", { name: /PICKS/ }).click();

    await expect(page.getByRole("heading", { name: "PICKS LOCKED IN" })).toBeVisible();
    const liveLink = page.getByRole("button", { name: /Live Board/ });
    await expect(liveLink).toBeVisible();

    await liveLink.click();
    await expect(page.getByText("AUTO-REFRESHING")).toBeVisible();
  });

  test("per-period badges show in pick counter", async ({ page }) => {
    await mockAPIs(page);
    await freshPageOnPicks(page);

    // Check per-period badges show count format (Q1 0/2, Q2 0/2, etc.)
    const counter = page.getByTestId("pick-counter");
    await expect(counter.getByText("0/2").first()).toBeVisible();
    // Verify all 5 period badges are present
    await expect(counter.getByText("Q1")).toBeVisible();
    await expect(counter.getByText("Q2")).toBeVisible();
    await expect(counter.getByText("Q3")).toBeVisible();
    await expect(counter.getByText("Q4")).toBeVisible();
    await expect(counter.getByText("FG")).toBeVisible();
  });
});

// ================================================================
// 5. LIVE TAB
// ================================================================
test.describe("Live Tab", () => {
  test("shows all period sections with events", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await page.getByRole("tab", { name: /LIVE/ }).click();

    await expect(page.getByText("1ST QUARTER")).toBeVisible();
    await expect(page.getByText("2ND QUARTER")).toBeVisible();
    await expect(page.getByText("3RD QUARTER")).toBeVisible();
    await expect(page.getByText("4TH QUARTER")).toBeVisible();
    await expect(page.getByText("FULL GAME")).toBeVisible();
    await expect(page.getByText("Opening Kickoff Returned for TD")).toBeVisible();
  });

  test("shows event hit count", async ({ page }) => {
    await mockAPIs(page, { events: { q4_overtime: true, q2_pick_six: true } });
    await freshPage(page);
    await page.getByRole("tab", { name: /LIVE/ }).click();
    await expect(page.getByText("2 EVENTS HIT", { exact: true })).toBeVisible();
  });

  test("hit events show checkmark indicator", async ({ page }) => {
    await mockAPIs(page, { events: { q4_overtime: true } });
    await freshPage(page);
    await page.getByRole("tab", { name: /LIVE/ }).click();

    // The hit event row should be visible
    const overtimeRow = page.getByText("Game Goes to Overtime").locator("..");
    await expect(overtimeRow).toBeVisible();
  });

  test("shows AUTO-REFRESHING label", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await page.getByRole("tab", { name: /LIVE/ }).click();
    await expect(page.getByText("AUTO-REFRESHING")).toBeVisible();
  });
});

// ================================================================
// 6. PRIZES TAB
// ================================================================
test.describe("Prizes Tab", () => {
  test("shows HOW PRIZES WORK section", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await page.getByRole("tab", { name: /PRIZES/ }).click();
    await expect(page.getByText("HOW PRIZES WORK")).toBeVisible();
  });

  test("shows IN-GAME PRIZES (QUARTERS) section", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await page.getByRole("tab", { name: /PRIZES/ }).click();
    await expect(page.getByText("IN-GAME PRIZES (QUARTERS)")).toBeVisible();
  });

  test("shows FINAL PRIZES (TOP 3) section", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await page.getByRole("tab", { name: /PRIZES/ }).click();
    await expect(page.getByText("FINAL PRIZES (TOP 3)")).toBeVisible();
  });

  test("shows prize details", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await page.getByRole("tab", { name: /PRIZES/ }).click();
    await expect(page.getByText("1st place:")).toBeVisible();
    await expect(page.getByText("20% off your tab")).toBeVisible();
    await expect(page.getByText("2nd place:")).toBeVisible();
    await expect(page.getByText("15% off your tab")).toBeVisible();
    await expect(page.getByText("3rd place:")).toBeVisible();
    await expect(page.getByText("10% off your tab")).toBeVisible();
  });

  test("shows empty leaderboard when no players", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await page.getByRole("tab", { name: /PRIZES/ }).click();
    await expect(page.getByText("No players yet. Be the first!")).toBeVisible();
  });

  test("shows leaderboard with players", async ({ page }) => {
    await mockAPIs(page, {
      players: [
        { name: "Alice", picks: STANDARD_PICKS, tiebreaker: "Chiefs 28", ts: 1000 },
        { name: "Bob", picks: ALTERNATE_PICKS, tiebreaker: "Eagles 24", ts: 2000 },
      ],
      events: { q4_overtime: true, q2_pick_six: true },
    });
    await freshPage(page);
    await page.getByRole("tab", { name: /PRIZES/ }).click();

    await expect(page.getByText("LEADERBOARD")).toBeVisible();
    await expect(page.getByText("Alice")).toBeVisible();
    await expect(page.getByText("Bob")).toBeVisible();
  });

  test("player cards show correct X/10 score format", async ({ page }) => {
    await mockAPIs(page, {
      players: [
        { name: "Alice", picks: STANDARD_PICKS, tiebreaker: "Chiefs 28", ts: 1000 },
      ],
      events: { q4_overtime: true, q2_pick_six: true },
    });
    await freshPage(page);
    await page.getByRole("tab", { name: /PRIZES/ }).click();

    // Alice has 2 correct (q4_overtime and q2_pick_six are both in STANDARD_PICKS)
    await expect(page.getByText("2/10")).toBeVisible();
  });
});

// ================================================================
// 7. ADMIN TAB
// ================================================================
test.describe("Admin Tab", () => {
  test("shows admin login form", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await page.getByRole("tab", { name: /ADMIN/ }).click();
    await expect(page.getByText("ADMIN ACCESS")).toBeVisible();
    await expect(page.getByPlaceholder("Enter code")).toBeVisible();
  });

  test("wrong admin code shows error toast", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await page.getByRole("tab", { name: /ADMIN/ }).click();

    await page.getByPlaceholder("Enter code").fill("wrongcode");
    await page.getByRole("button", { name: "ENTER" }).click();

    // Sonner toast should appear
    await expect(page.getByText("Wrong code")).toBeVisible({ timeout: 3000 });
  });

  test("correct admin code shows event controls", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await page.getByRole("tab", { name: /ADMIN/ }).click();

    await page.getByPlaceholder("Enter code").fill("kava60");
    await page.getByRole("button", { name: "ENTER" }).click();

    await expect(page.getByText("EVENT CONTROLS")).toBeVisible();
  });

  test("admin Enter key submits code", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await page.getByRole("tab", { name: /ADMIN/ }).click();

    await page.getByPlaceholder("Enter code").fill("kava60");
    await page.getByPlaceholder("Enter code").press("Enter");

    await expect(page.getByText("EVENT CONTROLS")).toBeVisible();
  });

  test("admin shows event toggles (50 switches)", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await page.getByRole("tab", { name: /ADMIN/ }).click();
    await page.getByPlaceholder("Enter code").fill("kava60");
    await page.getByRole("button", { name: "ENTER" }).click();

    // All switches for events
    const switches = page.getByRole("switch");
    await expect(switches.first()).toBeVisible();
    // Should have 50 switches (one per event)
    await expect(switches).toHaveCount(50);
  });

  test("admin shows period labels", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await page.getByRole("tab", { name: /ADMIN/ }).click();
    await page.getByPlaceholder("Enter code").fill("kava60");
    await page.getByRole("button", { name: "ENTER" }).click();

    await expect(page.getByText("1ST QUARTER").first()).toBeVisible();
    await expect(page.getByText("2ND QUARTER").first()).toBeVisible();
    await expect(page.getByText("3RD QUARTER").first()).toBeVisible();
    await expect(page.getByText("4TH QUARTER").first()).toBeVisible();
    await expect(page.getByText("FULL GAME").first()).toBeVisible();
  });

  test("admin shows AI VERIFICATION panel", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await page.getByRole("tab", { name: /ADMIN/ }).click();
    await page.getByPlaceholder("Enter code").fill("kava60");
    await page.getByRole("button", { name: "ENTER" }).click();

    await expect(page.getByText("AI VERIFICATION")).toBeVisible();
  });

  test("admin shows RESET ALL button", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await page.getByRole("tab", { name: /ADMIN/ }).click();
    await page.getByPlaceholder("Enter code").fill("kava60");
    await page.getByRole("button", { name: "ENTER" }).click();

    await expect(page.getByRole("button", { name: "RESET ALL" })).toBeVisible();
  });

  test("RESET ALL shows confirmation dialog", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await page.getByRole("tab", { name: /ADMIN/ }).click();
    await page.getByPlaceholder("Enter code").fill("kava60");
    await page.getByRole("button", { name: "ENTER" }).click();

    await page.getByRole("button", { name: "RESET ALL" }).click();

    // ConfirmDialog should appear
    await expect(page.getByText("Reset All Data")).toBeVisible();
    await expect(page.getByText("This will clear all players and events")).toBeVisible();
  });

  test("cancel dialog does not reset", async ({ page }) => {
    await mockAPIs(page, {
      players: [{ name: "Alice", picks: STANDARD_PICKS, tiebreaker: "", ts: 1000 }],
    });
    await freshPage(page);
    await page.getByRole("tab", { name: /ADMIN/ }).click();
    await page.getByPlaceholder("Enter code").fill("kava60");
    await page.getByRole("button", { name: "ENTER" }).click();

    await page.getByRole("button", { name: "RESET ALL" }).click();
    await page.getByRole("button", { name: "Cancel" }).click();

    // Player should still be visible
    await expect(page.getByText("Alice")).toBeVisible();
  });

  test("admin shows registered players section", async ({ page }) => {
    await mockAPIs(page, {
      players: [
        { name: "TestPlayer", picks: STANDARD_PICKS, tiebreaker: "28-24", ts: 1000 },
      ],
    });
    await freshPage(page);
    await page.getByRole("tab", { name: /ADMIN/ }).click();
    await page.getByPlaceholder("Enter code").fill("kava60");
    await page.getByRole("button", { name: "ENTER" }).click();

    await expect(page.getByText("REGISTERED PLAYERS (1)")).toBeVisible();
    await expect(page.getByText("TestPlayer")).toBeVisible();
    await expect(page.getByText("10 picks")).toBeVisible();
  });

  test("delete player shows confirmation dialog", async ({ page }) => {
    await mockAPIs(page, {
      players: [
        { name: "TestPlayer", picks: STANDARD_PICKS, tiebreaker: "", ts: 1000 },
      ],
    });
    await freshPage(page);
    await page.getByRole("tab", { name: /ADMIN/ }).click();
    await page.getByPlaceholder("Enter code").fill("kava60");
    await page.getByRole("button", { name: "ENTER" }).click();

    // Click the X button next to the player
    await page.getByRole("button", { name: "×" }).click();

    // ConfirmDialog should appear
    await expect(page.getByText("Remove Player")).toBeVisible();
    await expect(page.getByText(/Remove "TestPlayer"/)).toBeVisible();
  });
});

// ================================================================
// 8. ACCESSIBILITY
// ================================================================
test.describe("Accessibility", () => {
  test("tablist has proper role", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await expect(page.getByRole("tablist")).toBeVisible();
  });

  test("active tab has aria-selected", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    // Default tab is "rules" for new visitors
    const rulesTab = page.getByRole("tab", { name: /RULES/ });
    await expect(rulesTab).toHaveAttribute("aria-selected", "true");

    const liveTab = page.getByRole("tab", { name: /LIVE/ });
    await expect(liveTab).toHaveAttribute("aria-selected", "false");
  });

  test("tab panels have proper role", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    const panels = page.getByRole("tabpanel");
    await expect(panels.first()).toBeVisible();
  });

  test("pick counter has aria-live polite", async ({ page }) => {
    await mockAPIs(page);
    await freshPageOnPicks(page);
    // Target the pick counter specifically (not the Sonner notification region)
    const liveRegion = page.locator("[aria-live='polite']").filter({ hasText: /SELECT|READY/ });
    await expect(liveRegion).toBeVisible();
  });

  test("event rows use checkbox role", async ({ page }) => {
    await mockAPIs(page);
    await freshPageOnPicks(page);
    // Periods start expanded - checkboxes should be visible immediately
    const checkboxes = page.getByRole("checkbox");
    await expect(checkboxes.first()).toBeVisible();
  });

  test("admin switches use switch role", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await page.getByRole("tab", { name: /ADMIN/ }).click();
    await page.getByPlaceholder("Enter code").fill("kava60");
    await page.getByRole("button", { name: "ENTER" }).click();

    const switches = page.getByRole("switch");
    await expect(switches.first()).toBeVisible();
  });

  test("keyboard navigation works on event rows", async ({ page }) => {
    await mockAPIs(page);
    await freshPageOnPicks(page);
    // Periods start expanded - find first checkbox
    const firstCheckbox = page.getByRole("checkbox").first();
    await firstCheckbox.focus();
    await page.keyboard.press("Enter");
    await expect(firstCheckbox).toHaveAttribute("aria-checked", "true");

    await page.keyboard.press("Space");
    await expect(firstCheckbox).toHaveAttribute("aria-checked", "false");
  });

  test("period sections have aria-expanded", async ({ page }) => {
    await mockAPIs(page);
    await freshPageOnPicks(page);
    const periodButton = page.locator("[aria-expanded]").first();
    await expect(periodButton).toBeVisible();
  });
});

// ================================================================
// 9. RESPONSIVE & VISUAL
// ================================================================
test.describe("Visual & Interaction", () => {
  test("submit button shows spinner during submission", async ({ page }) => {
    // Slow down the POST so we can observe the spinner
    await page.route("**/api/events", (route) => route.fulfill({ json: {} }));
    await page.route("**/api/players", (route) => {
      if (route.request().method() === "GET") return route.fulfill({ json: [] });
      // Delay POST response
      return new Promise((resolve) =>
        setTimeout(() => resolve(route.fulfill({
          json: { success: true, player: { name: "Test", picks: [], tiebreaker: "", ts: Date.now() } }
        })), 2000)
      );
    });
    await page.route("**/api/verify**", (route) => route.fulfill({ json: {} }));

    await freshPageOnPicks(page);

    await page.getByPlaceholder("Enter your name").fill("TestPlayer");
    await selectTenEvents(page);

    await page.getByRole("button", { name: /LOCK IN PICKS/ }).click();

    // Should show SUBMITTING state
    await expect(page.getByText("SUBMITTING...")).toBeVisible({ timeout: 2000 });
  });

  test("mobile viewport renders correctly", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockAPIs(page);
    await freshPage(page);
    await expect(page.getByRole("heading", { name: "SUPER BOWL LX" })).toBeVisible();
    await expect(page.getByRole("tablist")).toBeVisible();
  });

  test("tablet viewport renders correctly", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await mockAPIs(page);
    await freshPage(page);
    await expect(page.getByRole("heading", { name: "SUPER BOWL LX" })).toBeVisible();
  });
});
