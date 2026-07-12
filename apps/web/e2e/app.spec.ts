import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function openDal(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Aaj kya pakayein/i })).toBeVisible();
  await page.locator(".editorial-card").click();
  await expect(page.getByRole("heading", { name: "Dal Tadka" })).toBeVisible();
}

async function beginTouchCook(page: Page): Promise<void> {
  await openDal(page);
  await page.getByRole("button", { name: /Cooking shuru karo/i }).click();
  await expect(page.getByRole("heading", { name: /Sab taiyaar hai/i })).toBeVisible();
  await page.getByRole("button", { name: /prep chhodo/i }).click();
  await expect(page.getByText(/Step 1 \/ 8/i)).toBeVisible();
}

test("touch-only Dal Tadka cook-through remains complete", async ({ page }) => {
  await beginTouchCook(page);
  for (let step = 2; step <= 8; step += 1) {
    await page.locator(".dock-next").click();
    await expect(page.getByText(`Step ${step} / 8`, { exact: true })).toBeVisible();
    if (step === 2) await page.locator(".whistle-sheet .close-button").click();
  }
  await page.locator(".dock-next").click();
  await expect(page.getByRole("heading", { name: /Ho gaya/i })).toBeVisible();
  await expect(page.getByText(/Cooked offline/i)).toBeVisible();
});

test("mocked Hinglish voice advances without touch navigation", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("rasoiguide-mic-explained", "true");
    class MockRecognition {
      lang = "hi-IN";
      continuous = false;
      interimResults = true;
      maxAlternatives = 3;
      onresult: ((event: unknown) => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        setTimeout(() => this.onresult?.({ resultIndex: 0, results: [{ 0: { transcript: "agla step", confidence: .99 }, isFinal: true }] }), 60);
      }
      stop() { setTimeout(() => this.onend?.(), 30); }
      abort() { this.onend?.(); }
    }
    Object.defineProperty(window, "SpeechRecognition", { value: MockRecognition, configurable: true });
    Object.defineProperty(window, "webkitSpeechRecognition", { value: MockRecognition, configurable: true });
  });
  await beginTouchCook(page);
  await page.locator(".ptt-button").click({ delay: 150 });
  await expect(page.getByText("Step 2 / 8", { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/Suna:.*agla step/i)).toBeVisible();
});

test("installed shell and active content survive airplane mode", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker?.ready;
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: /Aaj kya pakayein/i })).toBeVisible();
  await expect(page.getByText("Offline ready", { exact: true })).toBeVisible();
});

test("an interrupted cook is offered after a hard reload", async ({ page }) => {
  await beginTouchCook(page);
  await page.locator(".dock-next").click();
  await expect(page.getByText("Step 2 / 8", { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("rasoiguide:active-session-journal") ?? "{}").stepIndex)).toBe(1);
  await page.reload();
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Cooking jaari rakho.*step 2/i })).toBeVisible();
  await page.getByRole("button", { name: /Cooking jaari rakho.*step 2/i }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("rasoiguide:active-session-journal") ?? "{}").stepIndex)).toBe(1);
  await expect(page.locator(".cooking-page")).toHaveAttribute("data-cook-session-step", "1");
  await expect(page.locator(".cooking-page")).toHaveAttribute("data-cook-step-id", "pressure");
});

test("two-dish Thali creates a no-overlap master plan", async ({ page }) => {
  await page.goto("/");
  await page.locator(".thali-callout").click();
  await expect(page.getByRole("heading", { name: /Thali timeline/i }).last()).toBeVisible();
  await expect(page.getByText("Master timeline")).toBeVisible();
  await expect(page.locator(".timeline-lane")).toHaveCount(2);
  await expect(page.locator(".timeline-block--active").first()).toBeVisible();
});

test("library has no critical accessibility violations", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => violation.impact === "critical")).toEqual([]);
});
