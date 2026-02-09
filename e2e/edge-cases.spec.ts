import { test, expect, type Page } from "@playwright/test";

// ================================================================
// HELPERS (same as app.spec.ts)
// ================================================================

async function mockAPIs(
  page: Page,
  options?: {
    events?: Record<string, boolean>;
    players?: Array<{
      name: string;
      picks: string[];
      tiebreaker: string;
      ts: number;
    }>;
  }
) {
  const events = options?.events ?? {};
  const players = options?.players ?? [];

  await page.route("**/api/events", (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: events });
    return route.continue();
  });

  await page.route("**/api/players", (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: players });
    if (route.request().method() === "POST") {
      return route.fulfill({
        json: {
          success: true,
          player: {
            ...JSON.parse(route.request().postData() || "{}"),
            ts: Date.now(),
          },
        },
      });
    }
    return route.continue();
  });

  await page.route("**/api/events/*", (route) => {
    if (route.request().method() === "PUT")
      return route.fulfill({ json: events });
    return route.continue();
  });

  await page.route("**/api/players/*", (route) => {
    if (route.request().method() === "DELETE")
      return route.fulfill({ status: 200, json: { success: true } });
    return route.continue();
  });

  await page.route("**/api/reset", (route) => {
    if (route.request().method() === "POST")
      return route.fulfill({ status: 200, json: { success: true } });
    return route.continue();
  });

  await page.route("**/api/game-state", (route) =>
    route.fulfill({ json: { locked: false } })
  );

  await page.route("**/api/lock", (route) => {
    if (route.request().method() === "POST")
      return route.fulfill({ json: { locked: false } });
    return route.continue();
  });

  await page.route("**/api/verify**", (route) => route.fulfill({ json: {} }));
}

/** Navigate fresh: clears localStorage and lands on the default "rules" tab. */
async function freshPage(page: Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  await page.waitForSelector('[data-slot="tabs"]');
}

/** Navigate fresh and switch to the PICKS tab (default is now "rules"). */
async function freshPicksPage(page: Page) {
  await freshPage(page);
  await page.getByRole("tab", { name: /PICKS/ }).click();
}

/** Select exactly 10 events: 2 per period (Q1, Q2, Q3, Q4, FG). */
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

// ================================================================
// 1. STALE TOAST BUG (KNOWN BUG - expected to fail initially)
// ================================================================
test.describe("Stale Toast Bug", () => {
  test("wrong-code toast should dismiss after correct code is entered", async ({
    page,
  }) => {
    await mockAPIs(page);
    await freshPage(page);

    // Navigate to admin tab
    await page.getByRole("tab", { name: /ADMIN/ }).click();

    // Enter wrong code -> triggers "Wrong code" toast
    await page.getByPlaceholder("Enter code").fill("wrongcode");
    await page.getByRole("button", { name: "ENTER" }).click();
    await expect(page.getByText("Wrong code")).toBeVisible({ timeout: 3000 });

    // Now enter the correct code
    await page.getByPlaceholder("Enter code").fill("kava60");
    await page.getByRole("button", { name: "ENTER" }).click();

    // Admin panel should load
    await expect(page.getByText("EVENT CONTROLS")).toBeVisible({
      timeout: 3000,
    });

    // BUG: The "Wrong code" toast should NOT still be visible after
    // successfully authenticating. The expected behavior is that the
    // error toast dismisses (either auto-dismissed by now or manually
    // dismissed on successful auth). This test documents the bug.
    await expect(page.getByText("Wrong code")).not.toBeVisible({
      timeout: 5000,
    });
  });
});

// ================================================================
// 2. RAPID DOUBLE SUBMIT PREVENTION
// ================================================================
test.describe("Rapid Double Submit Prevention", () => {
  test("clicking submit twice rapidly should only fire one POST", async ({
    page,
  }) => {
    let postCount = 0;

    // Set up routes with a slow POST to widen the race window
    await page.route("**/api/events", (route) => {
      if (route.request().method() === "GET")
        return route.fulfill({ json: {} });
      return route.continue();
    });

    await page.route("**/api/players", (route) => {
      if (route.request().method() === "GET")
        return route.fulfill({ json: [] });
      if (route.request().method() === "POST") {
        postCount++;
        // Delay the response so the second click has time to arrive
        return new Promise((resolve) =>
          setTimeout(
            () =>
              resolve(
                route.fulfill({
                  json: {
                    success: true,
                    player: {
                      name: "TestPlayer",
                      picks: [],
                      tiebreaker: "",
                      ts: Date.now(),
                    },
                  },
                })
              ),
            1000
          )
        );
      }
      return route.continue();
    });

    await page.route("**/api/game-state", (route) =>
      route.fulfill({ json: { locked: false } })
    );
    await page.route("**/api/verify**", (route) =>
      route.fulfill({ json: {} })
    );

    await freshPicksPage(page);

    // Fill form
    await page.getByPlaceholder("Enter your name").fill("TestPlayer");
    await selectTenEvents(page);

    // Click submit -- button changes to "SUBMITTING..." and becomes disabled
    const submitBtn = page.getByRole("button", { name: /LOCK IN PICKS/ });
    await submitBtn.click();

    // Button should immediately show submitting state and be disabled
    const submittingBtn = page.getByRole("button", { name: /SUBMITTING/ });
    await expect(submittingBtn).toBeVisible({ timeout: 2000 });
    await expect(submittingBtn).toBeDisabled();

    // Try to click the disabled button via force -- should NOT fire another POST
    await submittingBtn.click({ force: true });

    // Wait for the submission to complete
    await page.waitForTimeout(2000);

    // Only one POST should have been fired
    expect(postCount).toBe(1);
  });

  test("submit button shows SUBMITTING state and is disabled during submission", async ({
    page,
  }) => {
    await page.route("**/api/events", (route) => {
      if (route.request().method() === "GET")
        return route.fulfill({ json: {} });
      return route.continue();
    });

    await page.route("**/api/players", (route) => {
      if (route.request().method() === "GET")
        return route.fulfill({ json: [] });
      if (route.request().method() === "POST") {
        return new Promise((resolve) =>
          setTimeout(
            () =>
              resolve(
                route.fulfill({
                  json: {
                    success: true,
                    player: {
                      name: "TestPlayer",
                      picks: [],
                      tiebreaker: "",
                      ts: Date.now(),
                    },
                  },
                })
              ),
            2000
          )
        );
      }
      return route.continue();
    });

    await page.route("**/api/game-state", (route) =>
      route.fulfill({ json: { locked: false } })
    );
    await page.route("**/api/verify**", (route) =>
      route.fulfill({ json: {} })
    );

    await freshPicksPage(page);
    await page.getByPlaceholder("Enter your name").fill("TestPlayer");
    await selectTenEvents(page);

    await page.getByRole("button", { name: /LOCK IN PICKS/ }).click();

    // Button should now be in submitting state and disabled
    await expect(page.getByText("SUBMITTING...")).toBeVisible({
      timeout: 2000,
    });
    const submitBtn = page
      .getByRole("button")
      .filter({ hasText: "SUBMITTING" });
    await expect(submitBtn).toBeDisabled();
  });
});

// ================================================================
// 3. 11TH PICK TOTAL REJECTION
// ================================================================
test.describe("11th Pick Total Rejection", () => {
  test("selecting an 11th event should be rejected and count stays at 10/10", async ({
    page,
  }) => {
    await mockAPIs(page);
    await freshPicksPage(page);

    // Select 10 events (2 per period)
    await selectTenEvents(page);
    await expect(page.getByText("10/10")).toBeVisible();
    await expect(page.getByText(/READY TO SUBMIT/)).toBeVisible();

    // Try to select an 11th event (from Q1, which already has 2)
    await page.getByText("No Points Scored in Q1 (0-0)").click();

    // Count should still be 10/10
    await expect(page.getByText("10/10")).toBeVisible();
    await expect(page.getByText(/READY TO SUBMIT/)).toBeVisible();

    // The 11th event checkbox should NOT be checked
    const extraCheckbox = page
      .locator('[role="checkbox"]')
      .filter({ hasText: "No Points Scored in Q1 (0-0)" });
    await expect(extraCheckbox).toHaveAttribute("aria-checked", "false");
  });

  test("11th pick event row should have reduced opacity (disabled state)", async ({
    page,
  }) => {
    await mockAPIs(page);
    await freshPicksPage(page);

    // Select 10 events (2 per period)
    await selectTenEvents(page);

    // Unselected events should have disabled styling (opacity-35 class)
    const extraCheckbox = page
      .locator('[role="checkbox"]')
      .filter({ hasText: "No Points Scored in Q1 (0-0)" });
    await expect(extraCheckbox).toHaveClass(/opacity-35/);
  });
});

// ================================================================
// 3b. 3RD PICK PER PERIOD REJECTION
// ================================================================
test.describe("3rd Pick Per Period Rejection", () => {
  test("selecting a 3rd event in the same period should be rejected", async ({
    page,
  }) => {
    await mockAPIs(page);
    await freshPicksPage(page);

    // Select 2 from Q3
    await page.getByText("First Drive of Second Half Scores TD").click();
    await page.getByText("No Points Scored in Q3").click();

    // Try a 3rd Q3 event -- should be rejected
    await page.getByText("Lead Changes Hands in Q3").click();

    // The 3rd event's checkbox should NOT be checked
    const thirdCheckbox = page
      .locator('[role="checkbox"]')
      .filter({ hasText: "Lead Changes Hands in Q3" });
    await expect(thirdCheckbox).toHaveAttribute("aria-checked", "false");

    // The first two should still be checked
    const firstCheckbox = page
      .locator('[role="checkbox"]')
      .filter({ hasText: "First Drive of Second Half Scores TD" });
    await expect(firstCheckbox).toHaveAttribute("aria-checked", "true");

    const secondCheckbox = page
      .locator('[role="checkbox"]')
      .filter({ hasText: "No Points Scored in Q3" });
    await expect(secondCheckbox).toHaveAttribute("aria-checked", "true");
  });

  test("3rd pick in a period should be disabled while other periods remain selectable", async ({
    page,
  }) => {
    await mockAPIs(page);
    await freshPicksPage(page);

    // Fill Q3 to its 2-pick cap
    await page.getByText("First Drive of Second Half Scores TD").click();
    await page.getByText("No Points Scored in Q3").click();

    // The remaining Q3 events should have disabled styling
    const thirdQ3Event = page
      .locator('[role="checkbox"]')
      .filter({ hasText: "Lead Changes Hands in Q3" });
    await expect(thirdQ3Event).toHaveClass(/opacity-35/);

    // But Q1 events should still be selectable (not disabled)
    const q1Event = page
      .locator('[role="checkbox"]')
      .filter({ hasText: "Opening Kickoff Returned for TD" });
    await expect(q1Event).not.toHaveClass(/opacity-35/);

    // Verify we can still select from other periods
    await page.getByText("Opening Kickoff Returned for TD").click();
    const q1Checkbox = page
      .locator('[role="checkbox"]')
      .filter({ hasText: "Opening Kickoff Returned for TD" });
    await expect(q1Checkbox).toHaveAttribute("aria-checked", "true");
  });
});

// ================================================================
// 4. NETWORK FAILURE DURING SUBMISSION
// ================================================================
test.describe("Network Failure During Submission", () => {
  test("500 error shows error toast and form remains usable", async ({
    page,
  }) => {
    // Mock POST to return 500
    await page.route("**/api/events", (route) => {
      if (route.request().method() === "GET")
        return route.fulfill({ json: {} });
      return route.continue();
    });

    await page.route("**/api/players", (route) => {
      if (route.request().method() === "GET")
        return route.fulfill({ json: [] });
      if (route.request().method() === "POST") {
        return route.fulfill({
          status: 500,
          json: { error: "Internal Server Error" },
        });
      }
      return route.continue();
    });

    await page.route("**/api/game-state", (route) =>
      route.fulfill({ json: { locked: false } })
    );
    await page.route("**/api/verify**", (route) =>
      route.fulfill({ json: {} })
    );

    await freshPicksPage(page);

    // Fill form
    await page.getByPlaceholder("Enter your name").fill("TestPlayer");
    await page
      .getByPlaceholder("e.g. Seahawks 27, Patriots 24")
      .fill("Seahawks 28, Patriots 21");
    await selectTenEvents(page);

    // Submit
    await page.getByRole("button", { name: /LOCK IN PICKS/ }).click();

    // Error toast should appear
    await expect(
      page.getByText(/Internal Server Error|Error saving picks/)
    ).toBeVisible({
      timeout: 3000,
    });

    // Form should NOT be locked -- the submit button should be re-enabled
    const submitBtn = page.getByRole("button", { name: /LOCK IN PICKS/ });
    await expect(submitBtn).toBeVisible({ timeout: 3000 });
    await expect(submitBtn).toBeEnabled();

    // Name field should still have the value
    await expect(page.getByPlaceholder("Enter your name")).toHaveValue(
      "TestPlayer"
    );

    // Picks should still be selected (10/10)
    await expect(page.getByText("10/10")).toBeVisible();
  });

  test("user can retry after network failure", async ({ page }) => {
    let attempt = 0;

    await page.route("**/api/events", (route) => {
      if (route.request().method() === "GET")
        return route.fulfill({ json: {} });
      return route.continue();
    });

    await page.route("**/api/players", (route) => {
      if (route.request().method() === "GET")
        return route.fulfill({ json: [] });
      if (route.request().method() === "POST") {
        attempt++;
        if (attempt === 1) {
          // First attempt fails
          return route.fulfill({
            status: 500,
            json: { error: "Server down" },
          });
        }
        // Second attempt succeeds
        return route.fulfill({
          json: {
            success: true,
            player: {
              name: "TestPlayer",
              picks: [],
              tiebreaker: "",
              ts: Date.now(),
            },
          },
        });
      }
      return route.continue();
    });

    await page.route("**/api/game-state", (route) =>
      route.fulfill({ json: { locked: false } })
    );
    await page.route("**/api/verify**", (route) =>
      route.fulfill({ json: {} })
    );

    await freshPicksPage(page);
    await page.getByPlaceholder("Enter your name").fill("TestPlayer");
    await selectTenEvents(page);

    // First attempt - fails
    await page.getByRole("button", { name: /LOCK IN PICKS/ }).click();
    await expect(
      page.getByText(/Server down|Error saving picks/)
    ).toBeVisible({
      timeout: 3000,
    });

    // Wait for form to unlock
    await expect(
      page.getByRole("button", { name: /LOCK IN PICKS/ })
    ).toBeEnabled({ timeout: 3000 });

    // Second attempt - succeeds
    await page.getByRole("button", { name: /LOCK IN PICKS/ }).click();
    await expect(page.getByText(/CONNECTING|UPDATED \d+S AGO/)).toBeVisible({
      timeout: 5000,
    });

    expect(attempt).toBe(2);
  });
});

// ================================================================
// 5. RAPID ADMIN EVENT TOGGLE (RACE CONDITION)
// ================================================================
test.describe("Rapid Admin Event Toggle", () => {
  test("quickly toggling same event twice should not corrupt state", async ({
    page,
  }) => {
    const toggledEvents: Record<string, boolean> = {};
    let putCount = 0;

    await page.route("**/api/events", (route) => {
      if (route.request().method() === "GET")
        return route.fulfill({ json: toggledEvents });
      return route.continue();
    });

    await page.route("**/api/players", (route) => {
      if (route.request().method() === "GET")
        return route.fulfill({ json: [] });
      return route.continue();
    });

    await page.route("**/api/events/*", (route) => {
      if (route.request().method() === "PUT") {
        putCount++;
        // Extract event id from URL
        const url = route.request().url();
        const eventId = url.split("/api/events/")[1];
        // Toggle the event state server-side
        toggledEvents[eventId] = !toggledEvents[eventId];
        // Simulate slight network delay
        return new Promise((resolve) =>
          setTimeout(
            () => resolve(route.fulfill({ json: { ...toggledEvents } })),
            200
          )
        );
      }
      return route.continue();
    });

    await page.route("**/api/reset", (route) => {
      if (route.request().method() === "POST")
        return route.fulfill({ status: 200, json: { success: true } });
      return route.continue();
    });

    await page.route("**/api/game-state", (route) =>
      route.fulfill({ json: { locked: false } })
    );
    await page.route("**/api/verify**", (route) =>
      route.fulfill({ json: {} })
    );

    await freshPage(page);

    // Authenticate as admin
    await page.getByRole("tab", { name: /ADMIN/ }).click();
    await page.getByPlaceholder("Enter code").fill("kava60");
    await page.getByRole("button", { name: "ENTER" }).click();
    await expect(page.getByText("EVENT CONTROLS")).toBeVisible();

    // Find the first switch
    const firstSwitch = page.getByRole("switch").first();

    // Initially off
    await expect(firstSwitch).toHaveAttribute("data-state", "unchecked");

    // Rapidly toggle twice (on then off)
    await firstSwitch.click();
    await firstSwitch.click();

    // Wait for both PUTs to resolve
    await page.waitForTimeout(1000);

    // After toggling twice (on -> off), the switch should be back to unchecked
    // The server also toggled twice, so both client and server should be "off"
    await expect(firstSwitch).toHaveAttribute("data-state", "unchecked");

    // Both PUT calls should have been made
    expect(putCount).toBe(2);
  });
});

// ================================================================
// 6. HASH ROUTING EDGE CASES
// ================================================================
test.describe("Hash Routing Edge Cases", () => {
  test("invalid hash defaults to RULES tab", async ({ page }) => {
    await mockAPIs(page);
    await page.goto("/#invalid");
    await page.evaluate(() => localStorage.clear());
    await page.goto("/#invalid");
    await page.waitForSelector('[data-slot="tabs"]');

    // The invalid hash should be ignored, defaulting to "rules"
    const rulesTab = page.getByRole("tab", { name: /RULES/ });
    await expect(rulesTab).toHaveAttribute("data-state", "active");
  });

  test("navigating to /#admin directly shows admin login", async ({
    page,
  }) => {
    await mockAPIs(page);
    await page.goto("/#admin");
    await page.waitForSelector('[data-slot="tabs"]');

    await expect(page.getByText("ADMIN ACCESS")).toBeVisible();
    const adminTab = page.getByRole("tab", { name: /ADMIN/ });
    await expect(adminTab).toHaveAttribute("data-state", "active");
  });

  test("browser back button navigates between tabs", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);

    // Navigate: RULES -> LIVE -> PRIZES
    await page.getByRole("tab", { name: /LIVE/ }).click();
    await expect(page).toHaveURL(/#live/);
    await expect(page.getByText(/CONNECTING|UPDATED \d+S AGO/)).toBeVisible();

    await page.getByRole("tab", { name: /PRIZES/ }).click();
    await expect(page).toHaveURL(/#prizes/);
    await expect(page.getByText("HOW PRIZES WORK")).toBeVisible();

    // Press back -> should go to LIVE (the previous hash)
    await page.goBack();
    await expect(page).toHaveURL(/#live/);

    // The LIVE tab should now be active
    const liveTab = page.getByRole("tab", { name: /LIVE/ });
    await expect(liveTab).toHaveAttribute("data-state", "active");
    await expect(page.getByText(/CONNECTING|UPDATED \d+S AGO/)).toBeVisible();
  });
});

// ================================================================
// 7. LONG PLAYER NAME
// ================================================================
test.describe("Long Player Name", () => {
  test("long name renders with truncation on prizes leaderboard", async ({
    page,
  }) => {
    const longName =
      "SuperLongPlayerNameThatExceedsFiftyCharacterLimitForTesting123";

    await mockAPIs(page, {
      players: [
        {
          name: longName,
          picks: [
            "q1_opening_kick_td",
            "q1_first_score_fg",
            "q2_pick_six",
            "q2_50yd_fg",
            "q3_first_drive_td",
            "q3_no_points",
            "q4_2pt_attempted",
            "q4_overtime",
            "fg_gatorade_orange",
            "fg_margin_3",
          ],
          tiebreaker: "Chiefs 28, Eagles 21",
          ts: 1000,
        },
      ],
      events: { q1_opening_kick_td: true },
    });

    await freshPage(page);
    await page.getByRole("tab", { name: /PRIZES/ }).click();

    // The player name should be visible (even if truncated visually)
    await expect(page.getByText("LEADERBOARD")).toBeVisible();

    // Find the name element -- it should have the truncate class
    const nameEl = page.locator(".truncate").filter({ hasText: longName });
    await expect(nameEl).toBeVisible();

    // Verify the truncate class and max-width constraint exist
    await expect(nameEl).toHaveClass(/truncate/);
    await expect(nameEl).toHaveClass(/max-w-/);
  });
});

// ================================================================
// 8. FORM VALIDATION EDGE CASES
// ================================================================
test.describe("Form Validation Edge Cases", () => {
  test("whitespace-only name triggers disabled submit button", async ({
    page,
  }) => {
    await mockAPIs(page);
    await freshPicksPage(page);

    // Enter whitespace-only name
    await page.getByPlaceholder("Enter your name").fill("   ");
    await selectTenEvents(page);

    // canSubmit checks !!playerName.trim(), so button should be disabled
    // because trim of "   " is "" which is falsy.
    const submitBtn = page.getByRole("button", { name: /LOCK IN PICKS/ });
    await expect(submitBtn).toBeDisabled();
  });

  test("name with no picks keeps submit button disabled", async ({ page }) => {
    await mockAPIs(page);
    await freshPicksPage(page);

    // Enter name but select 0 picks
    await page.getByPlaceholder("Enter your name").fill("TestPlayer");

    const submitBtn = page.getByRole("button", { name: /LOCK IN PICKS/ });
    await expect(submitBtn).toBeDisabled();
    await expect(page.getByText("0/10")).toBeVisible();
  });

  test("name with only 9 picks keeps submit button disabled", async ({
    page,
  }) => {
    await mockAPIs(page);
    await freshPicksPage(page);

    await page.getByPlaceholder("Enter your name").fill("TestPlayer");

    // Select 9 events: 2 from Q1, Q2, Q3, Q4 (8 total) + 1 from FG (9 total)
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
    // FG (1 -- intentionally incomplete)
    await page.getByText("Gatorade Bath Color Is ORANGE").click();

    await expect(page.getByText("9/10")).toBeVisible();

    const submitBtn = page.getByRole("button", { name: /LOCK IN PICKS/ });
    await expect(submitBtn).toBeDisabled();
  });

  test("empty name with 10 picks keeps submit button disabled", async ({
    page,
  }) => {
    await mockAPIs(page);
    await freshPicksPage(page);

    // Do not fill name, but select 10 picks
    await selectTenEvents(page);
    await expect(page.getByText("10/10")).toBeVisible();

    const submitBtn = page.getByRole("button", { name: /LOCK IN PICKS/ });
    await expect(submitBtn).toBeDisabled();
  });
});

// ================================================================
// 9. PERIOD SECTION COLLAPSE/EXPAND
// ================================================================
test.describe("Period Section Collapse/Expand", () => {
  test("collapsing a period hides its events", async ({ page }) => {
    await mockAPIs(page);
    await freshPicksPage(page);

    // Q1 events should be visible initially (collapsed=false)
    await expect(
      page.getByText("Opening Kickoff Returned for TD")
    ).toBeVisible();

    // Click the 1ST QUARTER header to collapse it
    const q1Button = page
      .locator("button[aria-expanded]")
      .filter({ hasText: "1ST QUARTER" });
    await q1Button.click();

    // Events inside should now be hidden
    await expect(
      page.getByText("Opening Kickoff Returned for TD")
    ).not.toBeVisible();
    await expect(
      page.getByText("Safety on First Offensive Play")
    ).not.toBeVisible();

    // aria-expanded should be false
    await expect(q1Button).toHaveAttribute("aria-expanded", "false");
  });

  test("pick is preserved after collapse and expand", async ({ page }) => {
    await mockAPIs(page);
    await freshPicksPage(page);

    // Select an event in Q1
    await page.getByText("Opening Kickoff Returned for TD").click();

    // Verify it is checked
    const q1Checkbox = page
      .locator('[role="checkbox"]')
      .filter({ hasText: "Opening Kickoff Returned for TD" });
    await expect(q1Checkbox).toHaveAttribute("aria-checked", "true");

    // Collapse 1ST QUARTER
    const q1Button = page
      .locator("button[aria-expanded]")
      .filter({ hasText: "1ST QUARTER" });
    await q1Button.click();
    await expect(
      page.getByText("Opening Kickoff Returned for TD")
    ).not.toBeVisible();

    // Expand 1ST QUARTER again
    await q1Button.click();
    await expect(
      page.getByText("Opening Kickoff Returned for TD")
    ).toBeVisible();

    // The pick should still be selected
    await expect(q1Checkbox).toHaveAttribute("aria-checked", "true");
  });

  test("period badge shows count of selected picks within period", async ({
    page,
  }) => {
    await mockAPIs(page);
    await freshPicksPage(page);

    // Select two Q1 events
    await page.getByText("Opening Kickoff Returned for TD").click();
    await page.getByText("First Score Is a Field Goal").click();

    // The 1ST QUARTER header should show a badge with "2"
    const q1Button = page
      .locator("button[aria-expanded]")
      .filter({ hasText: "1ST QUARTER" });
    await expect(q1Button.getByText("2")).toBeVisible();
  });
});

// ================================================================
// 10. ADMIN CODE CASE SENSITIVITY
// ================================================================
test.describe("Admin Code Case Sensitivity", () => {
  test('uppercase "KAVA60" should show wrong code error', async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await page.getByRole("tab", { name: /ADMIN/ }).click();

    await page.getByPlaceholder("Enter code").fill("KAVA60");
    await page.getByRole("button", { name: "ENTER" }).click();

    await expect(page.getByText("Wrong code")).toBeVisible({ timeout: 3000 });
    // Admin panel should NOT appear
    await expect(page.getByText("EVENT CONTROLS")).not.toBeVisible();
  });

  test('mixed case "Kava60" should show wrong code error', async ({
    page,
  }) => {
    await mockAPIs(page);
    await freshPage(page);
    await page.getByRole("tab", { name: /ADMIN/ }).click();

    await page.getByPlaceholder("Enter code").fill("Kava60");
    await page.getByRole("button", { name: "ENTER" }).click();

    await expect(page.getByText("Wrong code")).toBeVisible({ timeout: 3000 });
    await expect(page.getByText("EVENT CONTROLS")).not.toBeVisible();
  });

  test('only lowercase "kava60" should grant admin access', async ({
    page,
  }) => {
    await mockAPIs(page);
    await freshPage(page);
    await page.getByRole("tab", { name: /ADMIN/ }).click();

    await page.getByPlaceholder("Enter code").fill("kava60");
    await page.getByRole("button", { name: "ENTER" }).click();

    await expect(page.getByText("EVENT CONTROLS")).toBeVisible({
      timeout: 3000,
    });
    await expect(page.getByText("Wrong code")).not.toBeVisible();
  });
});
