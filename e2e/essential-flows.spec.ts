import { expect, test } from "@playwright/test";

test("login account-first, recupero password e layout responsive", async ({ page }, testInfo) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));

  await page.goto("/");
  await expect(page).toHaveTitle(/RobertaFunctional/);
  await expect(page.getByRole("heading", { name: "Il tuo allenamento, ovunque." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bentornato/a" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByText(/account vengono creati su invito/i)).toBeVisible();

  await page.getByRole("button", { name: "Hai dimenticato la password?" }).click();
  await expect(page.getByRole("heading", { name: "Recupera password" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Invia link" })).toBeVisible();
  await page.getByRole("button", { name: "Torna all’accesso" }).click();
  await expect(page.getByRole("button", { name: "Accedi" })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(runtimeErrors).toEqual([]);
  await page.screenshot({ path: `/tmp/roberta-login-${testInfo.project.name}.png`, fullPage: true });
});

test("navigazione da tastiera mantiene un focus visibile", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
  const outline = await page.locator(":focus").evaluate((element) => getComputedStyle(element).outlineStyle);
  expect(outline).not.toBe("none");
});
