import { test, expect } from "@playwright/test";

test("demo filters, inspector, export and responsive layout", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Des preuves/ }),
  ).toBeVisible();
  await expect(
    page.getByText("Données simulées", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Échecs", exact: true }).click();
  await expect(page.locator(".case")).toHaveCount(3);
  await page.getByRole("button", { name: /extract-zero/ }).click();
  await expect(page.locator(".inspector h3")).toHaveText("extract-zero");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exporter ↗" }).click();
  expect((await download).suggestedFilename()).toBe("localproof-report.json");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});

test("rejects invalid report", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("Importer un rapport JSON")).toBeEnabled();
  await page
    .getByLabel("Importer un rapport JSON")
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"hello":true}'),
    });
  await expect(page.locator("p[role=alert]")).toContainText("Import refusé");
});

test("JSON crash test identifies type errors, exports and handles equality", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByLabel("Importer un rapport JSON")).toBeEnabled();
  await page.getByRole("button", { name: "Trouver ce qui casse ↗" }).click();
  await expect(
    page.getByRole("heading", { name: "2 ruptures de contrat" }),
  ).toBeVisible();
  await expect(page.locator(".difference")).toHaveCount(2);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exporter le diagnostic" }).click();
  expect((await download).suggestedFilename()).toBe("localproof-diagnostic.md");
  await page
    .getByLabel("JSON observé")
    .fill(await page.getByLabel("JSON attendu").inputValue());
  await page.getByRole("button", { name: "Trouver ce qui casse ↗" }).click();
  await expect(
    page.getByRole("heading", { name: "Contrat respecté" }),
  ).toBeVisible();
  await page.getByLabel("JSON observé").fill("not json");
  await page.getByRole("button", { name: "Trouver ce qui casse ↗" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("JSON invalide");
});
