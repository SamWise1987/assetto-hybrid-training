import { expect, test } from "@playwright/test";
import { assignedPlan, athleteId, coachId, installSession, mockPlatformApi, planId } from "./platform-helpers";

test("cliente mantiene piano, Health, analisi e inbox anche dopo reload offline", async ({ page, context }, testInfo) => {
  await installSession(page, athleteId, "alex@example.com");
  await mockPlatformApi(page, "athlete");
  await page.goto("/");
  await expect(page.getByText("Alex", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Piano Hybrid test|Corsa facile/).first()).toBeVisible();

  await page.getByRole("button", { name: "Progressi" }).click();
  await expect(page.getByText("Aderenza blocco corrente")).toBeVisible();

  await page.getByRole("button", { name: "Analisi" }).click();
  await expect(page.getByRole("heading", { name: "Fonti dei dati" })).toBeVisible();
  await expect(page.getByText(/apple health/i).first()).toBeVisible();
  await expect(page.getByText(/nessuna serie inventata/i)).toBeVisible();

  await page.getByRole("button", { name: /Avvisi/ }).click();
  await expect(page.getByText("Il tuo piano è stato aggiornato")).toBeVisible();
  await page.getByRole("button", { name: "Apri avviso: Il tuo piano è stato aggiornato" }).click();
  await expect(page.getByRole("button", { name: "Oggi" })).toHaveAttribute("aria-current", "page");
  await expect(page).toHaveURL(/\?tab=today$/);
  await page.getByRole("button", { name: /Avvisi/ }).click();
  await page.screenshot({ path: `/tmp/roberta-athlete-${testInfo.project.name}.png`, fullPage: true });

  await page.evaluate(() => navigator.serviceWorker?.ready);
  await expect.poll(() => page.evaluate(async () => (await caches.keys()).includes("roberta-functional-shell-v6"))).toBe(true);
  await page.reload();
  await expect(page.getByText("Alex", { exact: true }).first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker?.controller))).toBe(true);
  await page.evaluate(async () => {
    const freshRoot = await fetch("/", { cache: "no-store" });
    const runtime = await caches.open("roberta-functional-runtime-v6");
    const shell = await caches.open("roberta-functional-shell-v6");
    await runtime.put("/", freshRoot.clone());
    await runtime.delete(`${window.location.pathname}${window.location.search}`);
    await shell.put("/", new Response("<!doctype html><title>Shell obsoleta</title><p>STALE_SHELL</p>", {
      headers: { "Content-Type": "text/html" },
    }));
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText("Alex", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("STALE_SHELL")).toHaveCount(0);
  await expect(page.getByText(/Modalità offline/)).toBeVisible();
  await context.setOffline(false);
});

test("URL, refresh e cronologia mantengono la sezione cliente", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "La cronologia browser è indipendente dal breakpoint.");
  await installSession(page, athleteId, "alex@example.com");
  await mockPlatformApi(page, "athlete");

  await page.goto("/?tab=calendar");
  await expect(page.getByRole("heading", { name: "Calendario", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Calendario", exact: true })).toHaveAttribute("aria-current", "page");

  await page.getByRole("button", { name: "Progressi" }).click();
  await expect(page).toHaveURL(/\?tab=progress$/);
  await expect(page.getByRole("heading", { name: "Progressi", exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Progressi", exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\?tab=calendar$/);
  await expect(page.getByRole("heading", { name: "Calendario", exact: true })).toBeVisible();
});

test("la web app aggiorna le attività Health quando torna visibile", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Il refresh foreground è indipendente dal breakpoint.");
  await installSession(page, athleteId, "alex@example.com");
  await mockPlatformApi(page, "athlete");
  await page.unroute("**/api/external-workouts**");
  let healthPulls = 0;
  await page.route("**/api/external-workouts**", (route) => {
    healthPulls += 1;
    const base = {
      source: "apple_health",
      platform: "ios",
      workout_type: "functionalStrengthTraining",
      kind: "strength",
      end_date: "2026-07-13T17:45:00.000Z",
      duration_minutes: 45,
      distance_km: null,
      calories_kcal: 260,
      average_heart_rate: 112,
      max_heart_rate: 145,
      source_name: "Apple Watch",
      matched_template_id: null,
      matched_at: null,
      imported_at: "2026-07-13T18:00:00.000Z",
    };
    const workouts = [{
      ...base,
      id: "66666666-6666-4666-8666-666666666666",
      external_id: "health-1",
      start_date: "2026-07-13T17:00:00.000Z",
    }];
    if (healthPulls > 1) workouts.push({
      ...base,
      id: "88888888-8888-4888-8888-888888888888",
      external_id: "health-2",
      start_date: "2026-07-15T17:00:00.000Z",
      end_date: "2026-07-15T17:45:00.000Z",
      imported_at: "2026-07-15T18:00:00.000Z",
    });
    return route.fulfill({ json: { workouts } });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Analisi" }).click();
  await expect(page.getByText(/1 attività · ultimo dato/)).toBeVisible();

  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));

  await expect.poll(() => healthPulls).toBeGreaterThan(1);
  await expect(page.getByText(/2 attività · ultimo dato/)).toBeVisible();
});

test("il cliente associa una forza Health a una scheda del piano attivo", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "L'abbinamento usa lo stesso flusso a ogni breakpoint.");
  await installSession(page, athleteId, "alex@example.com");
  await mockPlatformApi(page, "athlete");

  await page.goto("/");
  await page.getByRole("button", { name: "Analisi" }).click();
  await page.getByLabel("Associa alla scheda prevista").selectOption("lower-a");

  await expect(page.getByRole("status").filter({ hasText: "Attività associata alla scheda e sincronizzata." })).toBeVisible();
  await expect(page.getByText("Associato alla scheda")).toBeVisible();
});

test("il calendario non attribuisce una forza Health alla scheda sbagliata", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "La regola calendario è indipendente dal breakpoint.");
  await installSession(page, athleteId, "alex@example.com");
  await mockPlatformApi(page, "athlete");
  await page.unroute("**/api/external-workouts**");
  await page.route("**/api/external-workouts**", (route) => route.fulfill({ json: { workouts: [{
    id: "66666666-6666-4666-8666-666666666666",
    external_id: "health-1",
    source: "apple_health",
    platform: "ios",
    workout_type: "functionalStrengthTraining",
    kind: "strength",
    start_date: "2026-07-13T17:00:00.000Z",
    end_date: "2026-07-13T17:45:00.000Z",
    duration_minutes: 45,
    distance_km: null,
    calories_kcal: 260,
    average_heart_rate: 112,
    max_heart_rate: 145,
    source_name: "Apple Watch",
    matched_template_id: "upper",
    matched_at: "2026-07-13T18:00:00.000Z",
    imported_at: "2026-07-13T18:00:00.000Z",
  }] } }));

  await page.goto("/");
  await page.getByRole("button", { name: "Calendario", exact: true }).click();
  const lowerDay = page.getByRole("gridcell", { name: /lunedì 13 luglio, Lower forza/i });
  await expect(lowerDay).not.toHaveClass(/is-done/);
  await lowerDay.click();
  await expect(page.getByRole("heading", { name: "Lower forza" })).toBeVisible();
  await expect(page.getByText(/Attività Health associata alla scheda/)).toHaveCount(0);
});

test("il cliente può disattivare le push del dispositivo senza perdere l'inbox", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Il controllo Web Push è indipendente dal breakpoint.");
  await installSession(page, athleteId, "alex@example.com");
  await page.addInitScript(() => localStorage.setItem("assetto-device-id", "device-e2e"));
  await mockPlatformApi(page, "athlete");
  await page.unroute("**/api/push/register");
  let removedPayload: unknown;
  await page.route("**/api/push/register", async (route) => {
    if (route.request().method() === "DELETE") {
      removedPayload = route.request().postDataJSON();
      return route.fulfill({ json: { removed: true } });
    }
    return route.fulfill({ json: { subscriptions: [{ platform: "web", device_id: "device-e2e" }], webPushConfigured: true } });
  });

  await page.goto("/");
  await page.getByRole("button", { name: /Avvisi/ }).click();
  await expect(page.getByRole("button", { name: "Disattiva notifiche" })).toBeVisible();
  await page.getByRole("button", { name: "Disattiva notifiche" }).click();

  await expect(page.getByText(/Notifiche push disattivate su questo dispositivo/)).toBeVisible();
  expect(removedPayload).toEqual({ platform: "web", deviceId: "device-e2e" });
  await expect(page.getByText("Il tuo piano è stato aggiornato")).toBeVisible();
});

test("il cliente riceve versione e motivazione quando il trainer aggiorna lo stesso piano", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "La sincronizzazione piano è indipendente dal breakpoint.");
  await installSession(page, athleteId, "alex@example.com");
  await mockPlatformApi(page, "athlete");
  await page.unroute("**/api/plans/assigned");
  let planPulls = 0;
  await page.route("**/api/plans/assigned", (route) => {
    planPulls += 1;
    const updated = planPulls > 1;
    const reason = updated ? "Più recupero tra le sedute dopo la settimana recente." : "Piano iniziale condiviso dal trainer.";
    const version = updated ? 2 : 1;
    return route.fulfill({ json: {
      assignment: { id: "55555555-5555-4555-8555-555555555555", planId, athleteEmail: "alex@example.com", athleteUserId: athleteId, assignedBy: coachId, assignedAt: "2026-07-14T08:00:00.000Z", active: true },
      plan: { ...assignedPlan, name: updated ? "Piano Hybrid aggiornato" : assignedPlan.name, updatedAt: updated ? "2026-07-15T10:00:00.000Z" : assignedPlan.updatedAt, version, changeReason: reason },
      planVersion: { version, reason, createdAt: updated ? "2026-07-15T10:00:00.000Z" : "2026-07-14T08:00:00.000Z" },
    } });
  });

  await page.goto("/");
  await expect(page.getByText(/Nuovo piano dal trainer: Piano Hybrid test/)).toBeVisible();
  await page.getByRole("button", { name: "Chiudi avviso" }).click();

  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));

  await expect.poll(() => planPulls).toBeGreaterThan(1);
  await expect(page.getByText(/Piano aggiornato: Piano Hybrid aggiornato/)).toBeVisible();
  await expect(page.getByText("Più recupero tra le sedute dopo la settimana recente.")).toBeVisible();
});

test("trainer apre il cliente e modifica una copia strutturata della corsa", async ({ page }, testInfo) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  await installSession(page, coachId, "trainer@example.com");
  await mockPlatformApi(page, "coach");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Clienti", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Apri dettaglio" }).click();
  await expect(page.getByText("88%")).toBeVisible();
  await expect(page.getByText("Aderenza · 28 gg")).toBeVisible();
  await expect(page.getByText("Forza · 28 gg")).toBeVisible();
  await expect(page.getByText("Corse · 28 gg")).toBeVisible();
  await expect(page.getByText("Piano Hybrid test")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  if (testInfo.project.name !== "desktop-chromium") return;

  await page.getByRole("button", { name: "Piani" }).click();
  await page.waitForTimeout(500);
  expect(pageErrors, pageErrors.map((error) => error.stack ?? error.message).join("\n\n")).toEqual([]);
  await expect(page.getByRole("heading", { name: "Studio piani" })).toBeVisible();
  const runArticle = page.locator(".week-list article").filter({
    has: page.getByRole("textbox", { name: "Allenamento (run)" }),
  }).first();
  await runArticle.getByRole("button", { name: /Modifica esercizi/ }).click();
  await runArticle.getByLabel("Workout dalla libreria").selectOption("run-template-intervals-400");
  await expect(runArticle.getByText("Segmento 1")).toBeVisible();
  await runArticle.getByLabel("Ritmo target").first().fill("6:00/km");
  await expect(runArticle.getByLabel("Ritmo target").first()).toHaveValue("6:00/km");
  await page.screenshot({ path: "/tmp/roberta-trainer-builder-desktop.png", fullPage: true });
});

test("invito web completa login e mostra onboarding condiviso", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Il primo accesso viene provato sul viewport mobile principale.");
  await mockPlatformApi(page, "athlete", false);
  await page.goto("/");
  await page.getByLabel("Email").fill("alex@example.com");
  await page.getByLabel("Password").fill("password-test-123");
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page.getByRole("heading", { name: "Partiamo da te." })).toBeVisible();
  await page.getByLabel("Nome o nickname").fill("Alex");
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Quando ti alleni?" })).toBeVisible();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Collega Health." })).toBeVisible();
  await page.getByRole("button", { name: "Continua senza Health" }).click();
  const enter = page.getByRole("button", { name: "Entra nell’app" });
  await expect(enter).toBeDisabled();
  await page.getByLabel(/non sostituisce medico/i).check();
  await expect(enter).toBeDisabled();
  await page.getByLabel(/informativa privacy/i).check();
  await expect(enter).toBeEnabled();
  await enter.click();
  await expect(page.getByText("Alex", { exact: true }).first()).toBeVisible();
});

test("admin vede analisi operative senza dettagli sanitari individuali", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Il controllo privacy admin viene eseguito una volta sul layout desktop.");
  await installSession(page, coachId, "admin@example.com");
  await mockPlatformApi(page, "admin");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Invita un trainer" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Gestione ruoli" })).toBeVisible();
  await page.getByRole("button", { name: "Piani" }).click();
  await expect(page.getByRole("heading", { name: "Studio piani" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Crea account trainer" })).toHaveCount(0);
  await page.getByRole("button", { name: "Analisi" }).click();
  await expect(page.getByRole("heading", { name: "Analisi operative" })).toBeVisible();
  await expect(page.getByText(/dettagli atleta protetti/i)).toBeVisible();
  await expect(page.getByLabel("Cliente")).toHaveCount(0);
  await expect(page.getByText("Private rationale")).toHaveCount(0);
});

test("tab e griglia calendario supportano frecce e focus roving", async ({ page }) => {
  await installSession(page, athleteId, "alex@example.com");
  await mockPlatformApi(page, "athlete");
  await page.goto("/");
  await page.getByRole("button", { name: "Calendario", exact: true }).click();

  const monthTab = page.getByRole("tab", { name: "Mese" });
  const weekTab = page.getByRole("tab", { name: "Settimana" });
  await expect(monthTab).toHaveAttribute("aria-selected", "true");
  await monthTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(weekTab).toBeFocused();
  await expect(weekTab).toHaveAttribute("aria-selected", "true");

  const activeDay = page.locator('[role="gridcell"][tabindex="0"]');
  await expect(activeDay).toHaveCount(1);
  const originalLabel = await activeDay.getAttribute("aria-label");
  await activeDay.focus();
  await page.keyboard.press("ArrowRight");
  const nextDay = page.locator('[role="gridcell"]:focus');
  await expect(nextDay).toHaveAttribute("aria-selected", "true");
  await expect(nextDay).not.toHaveAttribute("aria-label", originalLabel ?? "");
  await expect(page.locator('[role="gridcell"][tabindex="0"]')).toHaveCount(1);
  await expect(page.locator('[role="gridcell"][aria-current="date"]')).toHaveCount(1);
});

test("i filtri della libreria espongono tab e pannello accessibili", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Il comportamento dei filtri è indipendente dal breakpoint.");
  await installSession(page, coachId, "trainer@example.com");
  await mockPlatformApi(page, "coach");
  await page.goto("/");
  await page.getByRole("button", { name: "Libreria" }).click();

  const allTab = page.getByRole("tab", { name: "Tutti" });
  await allTab.focus();
  await page.keyboard.press("ArrowRight");
  const selectedTab = page.locator('[role="tab"][aria-selected="true"]');
  await expect(selectedTab).toBeFocused();
  await expect(page.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", await selectedTab.getAttribute("id") ?? "");
});

test("la shell resta utilizzabile con testo al 200% su mobile", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Il caso critico combina testo al 200% e viewport da 390 px.");
  await installSession(page, athleteId, "alex@example.com");
  await mockPlatformApi(page, "athlete");
  await page.goto("/");
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });

  const assertNoClipping = async () => {
    const result = await page.evaluate(() => {
      const navigationButtons = [...document.querySelectorAll<HTMLButtonElement>(".bottom-nav button")];
      return {
        documentOverflow: document.documentElement.scrollWidth - (window.visualViewport?.width ?? document.documentElement.clientWidth),
        clipped: [...document.querySelectorAll<HTMLElement>(".app-header, .bottom-nav button, .bottom-nav button span, .calendar-toolbar, .metric-strip > div")]
          .filter((element) => element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1)
          .map((element) => `${element.tagName.toLowerCase()}.${element.className}`),
        blockedNavigation: navigationButtons.flatMap((button) => {
          const bounds = button.getBoundingClientRect();
          const hit = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
          return hit && button.contains(hit) ? [] : [button.textContent?.trim() ?? "pulsante senza etichetta"];
        }),
      };
    });
    expect(result.documentOverflow).toBeLessThanOrEqual(1);
    expect(result.clipped).toEqual([]);
    expect(result.blockedNavigation).toEqual([]);
  };

  await assertNoClipping();
  await page.getByRole("button", { name: "Calendario", exact: true }).click();
  await assertNoClipping();
  await page.getByRole("button", { name: "Progressi" }).click();
  await assertNoClipping();
  await page.getByRole("button", { name: /Avvisi/ }).click();
  await assertNoClipping();
});

test("il collegamento salta al contenuto resta nascosto finché non riceve focus da tastiera", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Il comportamento tastiera è indipendente dal breakpoint.");
  await page.goto("/");
  const skipLink = page.getByRole("link", { name: "Vai al contenuto" });
  await expect(skipLink).toHaveCSS("opacity", "0");
  await page.keyboard.press("Tab");
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toHaveCSS("opacity", "1");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main-content$/);
});
