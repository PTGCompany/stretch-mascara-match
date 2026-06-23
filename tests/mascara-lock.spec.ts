import { test, expect, Page } from "@playwright/test";

/**
 * Verifies that mascara (target) tiles, once revealed, stay visible for the
 * rest of the set — through the win transition (mancheWin overlay) and
 * through the loss/setResult transition — and only disappear when the next
 * set actually starts (tiles reset to hidden).
 */

const CONFIG_KEY = "sephora-game-config-v3";

// Selector for the mascara image rendered inside a revealed target tile.
const MASCARA_IMG = 'img[alt^="Sephora Collection — Big By Definition"]';

async function seedConfig(
  page: Page,
  overrides: Record<string, unknown>,
): Promise<void> {
  const base = {
    title: "MEMORY",
    titleAccent: "GAME",
    instruction: "TEST",
    targetProductName: "IT'S A STRETCH",
    targetsRequired: 2,
    targetsHidden: 4,
    attemptsAllowed: 4,
    durationSeconds: 999,
    gridCols: 2,
    gridRows: 2,
  };
  const cfg = { ...base, ...overrides };
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key as string, value as string);
      window.localStorage.removeItem("sephora-game-sessions");
    },
    [CONFIG_KEY, JSON.stringify(cfg)],
  );
}

function tile(page: Page, index: number) {
  return page.locator(`button[aria-label="Token ${index + 1}"]`);
}

async function isMascara(page: Page, index: number): Promise<boolean> {
  return (await tile(page, index).locator(MASCARA_IMG).count()) > 0;
}

async function startPlay(page: Page): Promise<void> {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  // Wait for hydration — the SSR'd button renders before React attaches
  // handlers, so click too early and nothing happens. networkidle is a
  // pragmatic proxy for "hydration complete" in this dev setup.
  await page.waitForLoadState("networkidle");
  const commencer = page.getByRole("button", { name: /commencer/i });
  await expect(commencer).toBeVisible();
  // Click and poll: if the first click loses to a still-attaching handler,
  // retry until the tile becomes enabled (phase === "setPlaying").
  await expect
    .poll(
      async () => {
        if (await tile(page, 0).isEnabled()) return true;
        await commencer.click({ trial: false }).catch(() => {});
        return false;
      },
      { timeout: 10_000, intervals: [200, 400, 600] },
    )
    .toBe(true);
}

test.describe("mascara tile lock", () => {
  test("target tiles remain visible during the WIN (mancheWin) transition", async ({
    page,
  }) => {
    // 4 cells, all mascara → first two clicks always win.
    await seedConfig(page, {
      targetsRequired: 2,
      targetsHidden: 4,
      attemptsAllowed: 4,
      gridCols: 2,
      gridRows: 2,
      durationSeconds: 999,
    });

    await startPlay(page);

    await tile(page, 0).click();
    await tile(page, 1).click();

    // Both mascaras visible immediately after their reveal animation.
    await expect(tile(page, 0).locator(MASCARA_IMG)).toBeVisible();
    await expect(tile(page, 1).locator(MASCARA_IMG)).toBeVisible();

    // Past the 2800 ms win hold → finishSet runs → mancheWin overlay opens.
    // Mascaras must STILL be in the DOM (locked for the rest of the set).
    await page.waitForTimeout(3200);
    expect(await isMascara(page, 0)).toBe(true);
    expect(await isMascara(page, 1)).toBe(true);

    // mancheWin only advances on user action — hold longer and re-check.
    await page.waitForTimeout(2500);
    expect(await isMascara(page, 0)).toBe(true);
    expect(await isMascara(page, 1)).toBe(true);
  });

  test("target tile remains visible during the LOSS (setResult) transition, then resets on next set", async ({
    page,
  }) => {
    // Every cell is a mascara, but only 1 attempt is allowed and 2 are
    // required → first click reveals a mascara AND ends the set as a loss.
    // This deterministically locks tile 0 with a mascara and forces the
    // loss-with-target branch (2800 ms hold).
    await seedConfig(page, {
      targetsRequired: 2,
      targetsHidden: 4,
      attemptsAllowed: 1,
      gridCols: 2,
      gridRows: 2,
      durationSeconds: 999,
    });

    await startPlay(page);

    await tile(page, 0).click();
    // The reveal completes within ~200 ms; the mascara should be visible.
    await expect(tile(page, 0).locator(MASCARA_IMG)).toBeVisible();

    // During the 2800 ms post-reveal hold, before finishSet fires.
    await page.waitForTimeout(1500);
    expect(await isMascara(page, 0)).toBe(true);

    // After finishSet → phase = setResult; 1600 ms until the next set starts.
    // Sample inside the setResult window — mascara must still be visible.
    await page.waitForTimeout(2000); // ~3.5 s total: well into setResult phase
    expect(await isMascara(page, 0)).toBe(true);

    // Once startSet runs the next manche, all tiles reset to "hidden" and
    // the lock is cleared. Wait long enough for set 2 to begin and verify
    // tile 0 no longer shows the previous set's mascara.
    await expect
      .poll(async () => isMascara(page, 0), { timeout: 6000, intervals: [200] })
      .toBe(false);
  });

  test("accidental second tap on a found mascara does not consume an attempt", async ({
    page,
  }) => {
    // All cells are mascaras, but the player needs 2 of them and has 3 tries
    // → first tap reveals + locks tile 0, the set keeps playing.
    await seedConfig(page, {
      targetsRequired: 2,
      targetsHidden: 4,
      attemptsAllowed: 3,
      gridCols: 2,
      gridRows: 2,
      durationSeconds: 999,
    });

    await startPlay(page);

    await tile(page, 0).click();
    await expect(tile(page, 0).locator(MASCARA_IMG)).toBeVisible();

    // The button must now be disabled / aria-disabled and not consume a tap.
    await expect(tile(page, 0)).toBeDisabled();
    await expect(tile(page, 0)).toHaveAttribute("aria-disabled", "true");

    // Essai counter shows "01/03" after the single legitimate reveal.
    await expect(page.getByText(/^01\s*\/\s*03$/)).toBeVisible();

    // Force a second tap on the locked mascara (bypasses pointer-events guard).
    await tile(page, 0).click({ force: true }).catch(() => {});
    await tile(page, 0).click({ force: true }).catch(() => {});

    // Counter must still read 01/03 — the locked tap was a no-op.
    await expect(page.getByText(/^01\s*\/\s*03$/)).toBeVisible();
    expect(await isMascara(page, 0)).toBe(true);
  });

  test("Rejouer starts a fresh game with no locked cards from the previous match", async ({
    page,
  }) => {
    // 1 attempt + 2 required + all mascaras → first click locks tile 0 and
    // ends the match as a loss across all 3 sets quickly.
    await seedConfig(page, {
      targetsRequired: 2,
      targetsHidden: 4,
      attemptsAllowed: 1,
      gridCols: 2,
      gridRows: 2,
      durationSeconds: 999,
    });

    await startPlay(page);
    await tile(page, 0).click();
    await expect(tile(page, 0).locator(MASCARA_IMG)).toBeVisible();

    // Wait for the full play to end (3 sets × (~2.8s hold + 1.6s setResult)).
    const rejouer = page.getByRole("button", { name: /rejouer/i });
    await expect(rejouer).toBeVisible({ timeout: 20_000 });

    await rejouer.click();

    // After Rejouer, every tile must be hidden — no mascara left over from
    // the previous match's locked state.
    await expect
      .poll(
        async () => {
          for (let i = 0; i < 4; i++) {
            if (await isMascara(page, i)) return false;
          }
          return await tile(page, 0).isEnabled();
        },
        { timeout: 10_000, intervals: [200] },
      )
      .toBe(true);

    // Essai counter resets to 00/01.
    await expect(page.getByText(/^00\s*\/\s*01$/)).toBeVisible();
  });
});
