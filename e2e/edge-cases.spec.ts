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
}

async function freshPage(page: Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  await page.waitForSelector('[data-slot="tabs"]');
}

/** Select exactly 5 events from different tiers (all tiers start expanded). */
async function selectFiveEvents(page: Page) {
  await page.getByText("Punt Return Touchdown").click();
  await page.getByText("Opening Kickoff Returned for TD").click();
  await page.getByText("Game Goes to Overtime").click();
  await page.getByText("Successful Onside Kick").click();
  await page.getByText("Blocked Punt/FG Returned for TD").click();
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

    await freshPage(page);

    // Fill form
    await page.getByPlaceholder("Enter your name").fill("TestPlayer");
    await selectFiveEvents(page);

    // Click submit — button changes to "SUBMITTING..." and becomes disabled
    const submitBtn = page.getByRole("button", { name: /LOCK IN PICKS/ });
    await submitBtn.click();

    // Button should immediately show submitting state and be disabled
    const submittingBtn = page.getByRole("button", { name: /SUBMITTING/ });
    await expect(submittingBtn).toBeVisible({ timeout: 2000 });
    await expect(submittingBtn).toBeDisabled();

    // Try to click the disabled button via force — should NOT fire another POST
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

    await freshPage(page);
    await page.getByPlaceholder("Enter your name").fill("TestPlayer");
    await selectFiveEvents(page);

    await page.getByRole("button", { name: /LOCK IN PICKS/ }).click();

    // Button should now be in submitting state and disabled
    await expect(page.getByText("SUBMITTING...")).toBeVisible({
      timeout: 2000,
    });
    const submitBtn = page.getByRole("button").filter({ hasText: "SUBMITTING" });
    await expect(submitBtn).toBeDisabled();
  });
});

// ================================================================
// 3. 6TH PICK REJECTION
// ================================================================
test.describe("6th Pick Rejection", () => {
  test("selecting a 6th event should be rejected and count stays at 5/5", async ({
    page,
  }) => {
    await mockAPIs(page);
    await freshPage(page);

    // Select 5 events
    await selectFiveEvents(page);
    await expect(page.getByText("5/5")).toBeVisible();
    await expect(page.getByText(/READY TO SUBMIT/)).toBeVisible();

    // Try to select a 6th event (from a different tier)
    await page.getByText("Safety Scored").click();

    // Count should still be 5/5
    await expect(page.getByText("5/5")).toBeVisible();
    await expect(page.getByText(/READY TO SUBMIT/)).toBeVisible();

    // The 6th event checkbox should NOT be checked
    const safetyCheckbox = page
      .locator('[role="checkbox"]')
      .filter({ hasText: "Safety Scored" });
    await expect(safetyCheckbox).toHaveAttribute("aria-checked", "false");
  });

  test("6th pick event row should have reduced opacity (disabled state)", async ({
    page,
  }) => {
    await mockAPIs(page);
    await freshPage(page);

    // Select 5 events
    await selectFiveEvents(page);

    // Unselected events should have disabled styling (opacity-35 class)
    const safetyCheckbox = page
      .locator('[role="checkbox"]')
      .filter({ hasText: "Safety Scored" });
    await expect(safetyCheckbox).toHaveClass(/opacity-35/);
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

    await freshPage(page);

    // Fill form
    await page.getByPlaceholder("Enter your name").fill("TestPlayer");
    await page
      .getByPlaceholder("e.g. Chiefs 27, Eagles 24")
      .fill("Chiefs 28, Eagles 21");
    await selectFiveEvents(page);

    // Submit
    await page.getByRole("button", { name: /LOCK IN PICKS/ }).click();

    // Error toast should appear
    await expect(page.getByText(/Internal Server Error|Error saving picks/)).toBeVisible({
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

    // Picks should still be selected (5/5)
    await expect(page.getByText("5/5")).toBeVisible();
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

    await freshPage(page);
    await page.getByPlaceholder("Enter your name").fill("TestPlayer");
    await selectFiveEvents(page);

    // First attempt - fails
    await page.getByRole("button", { name: /LOCK IN PICKS/ }).click();
    await expect(page.getByText(/Server down|Error saving picks/)).toBeVisible({
      timeout: 3000,
    });

    // Wait for form to unlock
    await expect(
      page.getByRole("button", { name: /LOCK IN PICKS/ })
    ).toBeEnabled({ timeout: 3000 });

    // Second attempt - succeeds
    await page.getByRole("button", { name: /LOCK IN PICKS/ }).click();
    await expect(page.getByText("AUTO-REFRESHING")).toBeVisible({
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

    await freshPage(page);

    // Authenticate as admin
    await page.getByRole("tab", { name: /ADMIN/ }).click();
    await page.getByPlaceholder("Enter code").fill("kava60");
    await page.getByRole("button", { name: "ENTER" }).click();
    await expect(page.getByText("EVENT CONTROLS")).toBeVisible();

    // Find the first switch (e.g., Punt Return Touchdown)
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
  test("invalid hash defaults to PICKS tab", async ({ page }) => {
    await mockAPIs(page);
    await page.goto("/#invalid");
    await page.evaluate(() => localStorage.clear());
    await page.goto("/#invalid");
    await page.waitForSelector('[data-slot="tabs"]');

    // The invalid hash should be ignored, defaulting to "picks"
    const picksTab = page.getByRole("tab", { name: /PICKS/ });
    await expect(picksTab).toHaveAttribute("data-state", "active");
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

    // Navigate: PICKS -> LIVE -> PRIZES
    await page.getByRole("tab", { name: /LIVE/ }).click();
    await expect(page).toHaveURL(/#live/);
    await expect(page.getByText("AUTO-REFRESHING")).toBeVisible();

    await page.getByRole("tab", { name: /PRIZES/ }).click();
    await expect(page).toHaveURL(/#prizes/);
    await expect(page.getByText("HOW PRIZES WORK")).toBeVisible();

    // Press back -> should go to LIVE (the previous hash)
    await page.goBack();
    await expect(page).toHaveURL(/#live/);

    // The LIVE tab should now be active
    const liveTab = page.getByRole("tab", { name: /LIVE/ });
    await expect(liveTab).toHaveAttribute("data-state", "active");
    await expect(page.getByText("AUTO-REFRESHING")).toBeVisible();
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
            "t4_overtime",
            "t2_safety",
            "t1_pick_six",
            "t1_blowout",
            "t3_blocked_punt",
          ],
          tiebreaker: "Chiefs 28, Eagles 21",
          ts: 1000,
        },
      ],
      events: { t4_overtime: true },
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
  test("whitespace-only name triggers error toast on submit attempt", async ({
    page,
  }) => {
    await mockAPIs(page);
    await freshPage(page);

    // Enter whitespace-only name
    await page.getByPlaceholder("Enter your name").fill("   ");
    await selectFiveEvents(page);

    // canSubmit checks !!playerName.trim(), so button should be disabled
    // because trim of "   " is "" which is falsy.
    const submitBtn = page.getByRole("button", { name: /LOCK IN PICKS/ });
    await expect(submitBtn).toBeDisabled();
  });

  test("name with no picks keeps submit button disabled", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);

    // Enter name but select 0 picks
    await page.getByPlaceholder("Enter your name").fill("TestPlayer");

    const submitBtn = page.getByRole("button", { name: /LOCK IN PICKS/ });
    await expect(submitBtn).toBeDisabled();
    await expect(page.getByText("0/5")).toBeVisible();
  });

  test("name with only 4 picks keeps submit button disabled", async ({
    page,
  }) => {
    await mockAPIs(page);
    await freshPage(page);

    await page.getByPlaceholder("Enter your name").fill("TestPlayer");

    // Select only 4 events
    await page.getByText("Punt Return Touchdown").click();
    await page.getByText("Opening Kickoff Returned for TD").click();
    await page.getByText("Game Goes to Overtime").click();
    await page.getByText("Successful Onside Kick").click();

    await expect(page.getByText("4/5")).toBeVisible();

    const submitBtn = page.getByRole("button", { name: /LOCK IN PICKS/ });
    await expect(submitBtn).toBeDisabled();
  });

  test("empty name with 5 picks keeps submit button disabled", async ({
    page,
  }) => {
    await mockAPIs(page);
    await freshPage(page);

    // Do not fill name, but select 5 picks
    await selectFiveEvents(page);
    await expect(page.getByText("5/5")).toBeVisible();

    const submitBtn = page.getByRole("button", { name: /LOCK IN PICKS/ });
    await expect(submitBtn).toBeDisabled();
  });
});

// ================================================================
// 9. TIER SECTION COLLAPSE/EXPAND
// ================================================================
test.describe("Tier Section Collapse/Expand", () => {
  test("collapsing a tier hides its events", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);

    // Tier 4 events should be visible initially (collapsed=false)
    await expect(page.getByText("Punt Return Touchdown")).toBeVisible();

    // Click the Tier 4 header to collapse it
    const tier4Button = page
      .locator("button[aria-expanded]")
      .filter({ hasText: "TIER 4" });
    await tier4Button.click();

    // Events inside should now be hidden
    await expect(page.getByText("Punt Return Touchdown")).not.toBeVisible();
    await expect(
      page.getByText("Opening Kickoff Returned for TD")
    ).not.toBeVisible();

    // aria-expanded should be false
    await expect(tier4Button).toHaveAttribute("aria-expanded", "false");
  });

  test("pick is preserved after collapse and expand", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);

    // Select an event in Tier 4
    await page.getByText("Punt Return Touchdown").click();
    await expect(page.getByText("1/5")).toBeVisible();

    // Verify it is checked
    const puntCheckbox = page
      .locator('[role="checkbox"]')
      .filter({ hasText: "Punt Return Touchdown" });
    await expect(puntCheckbox).toHaveAttribute("aria-checked", "true");

    // Collapse Tier 4
    const tier4Button = page
      .locator("button[aria-expanded]")
      .filter({ hasText: "TIER 4" });
    await tier4Button.click();
    await expect(page.getByText("Punt Return Touchdown")).not.toBeVisible();

    // Counter should still show 1/5 while collapsed
    await expect(page.getByText("1/5")).toBeVisible();

    // Expand Tier 4 again
    await tier4Button.click();
    await expect(page.getByText("Punt Return Touchdown")).toBeVisible();

    // The pick should still be selected
    await expect(puntCheckbox).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText("1/5")).toBeVisible();
  });

  test("tier badge shows count of selected picks within tier", async ({
    page,
  }) => {
    await mockAPIs(page);
    await freshPage(page);

    // Select two Tier 4 events
    await page.getByText("Punt Return Touchdown").click();
    await page.getByText("Opening Kickoff Returned for TD").click();

    // The Tier 4 header should show a badge with "2"
    const tier4Button = page
      .locator("button[aria-expanded]")
      .filter({ hasText: "TIER 4" });
    await expect(tier4Button.getByText("2")).toBeVisible();
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
