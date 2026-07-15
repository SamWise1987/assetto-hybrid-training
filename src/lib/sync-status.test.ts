import { describe, expect, it } from "vitest";
import { syncBannerState } from "./sync-status";

describe("syncBannerState", () => {
  it("distingue offline, sync ordinaria, errore e conflitto", () => {
    expect(syncBannerState({ online: false, pending: 2, failed: 0, conflicts: 0 })).toEqual({
      tone: "info",
      message: "Modalità offline · 2 modifiche salvate sul dispositivo",
    });
    expect(syncBannerState({ online: true, pending: 1, failed: 0, conflicts: 0 })).toEqual({
      tone: "info",
      message: "1 modifica in sincronizzazione",
    });
    expect(syncBannerState({ online: true, pending: 2, failed: 2, conflicts: 0 })).toEqual({
      tone: "error",
      message: "2 modifiche non sincronizzate. I dati locali sono al sicuro.",
      actionLabel: "Riprova",
    });
    expect(syncBannerState({ online: true, pending: 3, failed: 3, conflicts: 1 })).toEqual({
      tone: "error",
      message: "1 conflitto tra dispositivi. Le modifiche locali sono al sicuro.",
      actionLabel: "Risolvi e riprova",
    });
  });
});
