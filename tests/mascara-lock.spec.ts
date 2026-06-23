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

async function isMascara(page: Page, index: number): Promise<boolean> {
  const tile = page.getByRole("button", { name: `Token ${index + 1}` });
  return (await tile.locator(MASCARA_IMG).count()) > 0;
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

    await page.goto("/");
    await page.getByRole("button", { name: /commencer/i }).click();

    // Wait for grid.
    await expect(page.getByRole("button", { name: "Token 1" })).toBeVisible();

    // Click two tiles → both are mascaras → win triggers after 2800 ms.
    await page.getByRole("button", { name: "Token 1" }).click();
    await page.getByRole("button", { name: "Token 2" }).click();

    // Both mascaras must be visible immediately after click.
    await expect(
      page.getByRole("button", { name: "Token 1" }).locator(MASCARA_IMG),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Token 2" }).locator(MASCARA_IMG),
    ).toBeVisible();

    // Wait past the 2800 ms win delay → mancheWin overlay appears.
    // Mascaras must STILL be in the DOM and visible behind / alongside it.
    await page.waitForTimeout(3200);

    expect(await isMascara(page, 0)).toBe(true);
    expect(await isMascara(page, 1)).toBe(true);

    // Hold longer — mancheWin only advances on user action; tiles must
    // stay locked the entire time.
    await page.waitForTimeout(2000);
    expect(await isMascara(page, 0)).toBe(true);
    expect(await isMascara(page, 1)).toBe(true);
  });

  test("target tile remains visible during the LOSS (setResult) transition, then resets on next set", async ({
    page,
  }) => {
    // 4 cells, exactly 1 mascara. attemptsAllowed=2, targetsRequired=2 →
    // a single set can never be won; second click always ends the set.
    await seedConfig(page, {
      targetsRequired: 2,
      targetsHidden: 1,
      attemptsAllowed: 2,
      gridCols: 2,
      gridRows: 2,
      durationSeconds: 999,
    });

    await page.goto("/");
    await page.getByRole("button", { name: /commencer/i }).click();
    await expect(page.getByRole("button", { name: "Token 1" })).toBeVisible();

    // Locate the mascara: click each tile and look for the mascara image,
    // but to keep the locked tile state we need to find the mascara FIRST.
    // Strategy: click tile 1; if it's the mascara, click an empty next so the
    // second (losing) click is the empty one with the mascara still locked.
    // If tile 1 was empty, it flips back after ~900 ms; then click tile 2
    // (or 3, 4) until we hit the mascara as the LAST attempt.
    await page.getByRole("button", { name: "Token 1" }).click();
    const firstWasMascara = await isMascara(page, 0);

    let mascaraIndex: number;
    if (firstWasMascara) {
      // Mascara is tile 0 (locked). End the set by clicking an empty tile.
      // That empty click becomes attempt #2 → loss.
      mascaraIndex = 0;
      await page.getByRole("button", { name: "Token 2" }).click();
    } else {
      // Tile 1 was empty → it flips back after 900 ms. Probe remaining tiles.
      await page.waitForTimeout(1100);
      let found = -1;
      for (const i of [1, 2, 3]) {
        await page.getByRole("button", { name: `Token ${i + 1}` }).click();
        if (await isMascara(page, i)) {
          found = i;
          break;
        }
        // Empty → flips back; keep probing on the NEXT set… but we only have
        // one set here. With targetsHidden=1 and 4 tiles, by the 4th click we
        // must have hit the mascara. attemptsAllowed=2 ends the set early —
        // so we may end the set on a non-mascara probe. Re-seed and retry.
        await page.waitForTimeout(1100);
        // After 2nd attempt (i===1) the set ends → break to retry path.
        if (i === 1) break;
      }
      if (found === -1) {
        // Could not isolate mascara as last click within attemptsAllowed.
        // Force the scenario deterministically by reloading with a 1-attempt
        // budget so the very first click ends the set.
        await page.evaluate((k) => localStorage.removeItem(k), CONFIG_KEY);
        await seedConfig(page, {
          targetsRequired: 2,
          targetsHidden: 4, // every tile is mascara
          attemptsAllowed: 1,
          gridCols: 2,
          gridRows: 2,
          durationSeconds: 999,
        });
        await page.goto("/");
        await page.getByRole("button", { name: /commencer/i }).click();
        await page.getByRole("button", { name: "Token 1" }).click();
        mascaraIndex = 0;
      } else {
        mascaraIndex = found;
      }
    }

    // The losing click has fired. There is a 2800 ms hold (because the last
    // tile clicked was a target in the win-overlap path, OR 700 ms when the
    // last click was empty). Sample BEFORE finishSet runs.
    await page.waitForTimeout(400);
    expect(await isMascara(page, mascaraIndex)).toBe(true);

    // After finishSet → setResult phase; 1600 ms until the next set starts.
    // Sample during that window — mascara must still be visible.
    await page.waitForTimeout(2800 + 200);
    expect(await isMascara(page, mascaraIndex)).toBe(true);

    // Once startSet runs (≥ 1600 ms after setResult), tiles reset to hidden
    // and the lock is cleared.
    await page.waitForTimeout(1800);
    // Either we've moved to the next set (tiles hidden again) OR — if this
    // was the last set — we're in playResult. In both cases the mascara
    // image for the previous set must no longer be present at that index.
    expect(await isMascara(page, mascaraIndex)).toBe(false);
  });
});
