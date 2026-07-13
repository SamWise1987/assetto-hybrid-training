import { expect, test, type Page } from "@playwright/test";

async function onboard(page: Page) {
  await page.goto("/");
  await page.locator('[data-hydrated="true"]').waitFor();
  if (await page.getByRole("heading", { name: /Il tuo piano/ }).isVisible().catch(() => false)) {
    await page.getByLabel(/Ho compreso che RobertaFunctional/).check();
    await page.getByRole("button", { name: "Crea il mio piano" }).click();
  }
  await expect(page.getByRole("heading", { name: "Forza A" })).toBeVisible();
}

test("onboarding e creazione del piano", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-hydrated="true"]').waitFor();
  await expect(page.getByRole("heading", { name: /Il tuo piano si adatta/ })).toBeVisible();
  await page.getByLabel(/Ho compreso che RobertaFunctional/).check();
  await page.getByRole("button", { name: "Crea il mio piano" }).click();
  await expect(page.getByRole("heading", { name: "Forza A" })).toBeVisible();
});

test("completamento di una seduta di forza", async ({ page }) => {
  await onboard(page);
  await page.getByRole("button", { name: /Inizia check-in/ }).click();
  await page.getByRole("button", { name: "Conferma e continua" }).click();
  await page.getByRole("button", { name: /Vai alla seduta/ }).click();
  await page.getByRole("button", { name: /Conferma serie/ }).click();
  await page.getByRole("button", { name: "Termina" }).click();
  await page.getByRole("button", { name: "Completa seduta" }).click();
  await expect(page.getByText("Seduta registrata")).toBeVisible();
});

test("registrazione della risposta il giorno seguente", async ({ page }) => {
  await onboard(page);
  await page.getByRole("button", { name: /Risposta nelle 24 ore/ }).click();
  await page.getByRole("button", { name: "Registra risposta" }).click();
  await expect(page.getByText(/Il motore potrà valutarla/)).toBeVisible();
});

test("modifica automatica spiegata e annullabile", async ({ page }) => {
  await onboard(page);
  await page.getByRole("button", { name: "Progressi" }).click();
  await expect(page.getByRole("heading", { name: "Modifiche automatiche" })).toBeVisible();
  await expect(page.getByText(/due esposizioni solide/i).first()).toBeVisible();
  await page.getByRole("button", { name: "Annulla modifica" }).first().click();
  await expect(page.getByText("Annullata").first()).toBeVisible();
});

test("registrazione di una corsa", async ({ page }) => {
  await onboard(page);
  await page.getByRole("button", { name: "Calendario" }).click();
  await page.getByRole("button", { name: "Registra una corsa" }).click();
  await page.getByRole("button", { name: /Salva corsa/ }).click();
  await expect(page.getByRole("button", { name: "Registra una corsa" })).toBeVisible();
});

test("esportazione JSON", async ({ page }) => {
  await onboard(page);
  await page.getByRole("button", { name: "Impostazioni" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /Esporta database JSON/ }).click();
  expect((await download).suggestedFilename()).toMatch(/roberta-functional-backup-.*\.json/);
});
