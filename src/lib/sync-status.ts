interface SyncBannerInput {
  online: boolean;
  pending: number;
  failed: number;
  conflicts: number;
}

export function syncBannerState({ online, pending, failed, conflicts }: SyncBannerInput) {
  if (!online) {
    return {
      tone: "info" as const,
      message: `Modalità offline · ${pending} modific${pending === 1 ? "a" : "he"} salvat${pending === 1 ? "a" : "e"} sul dispositivo`,
    };
  }
  if (conflicts > 0) {
    return {
      tone: "error" as const,
      message: `${conflicts} conflitto${conflicts === 1 ? "" : "i"} tra dispositivi. Le modifiche locali sono al sicuro.`,
      actionLabel: "Risolvi e riprova",
    };
  }
  if (failed > 0) {
    return {
      tone: "error" as const,
      message: `${failed} modific${failed === 1 ? "a non sincronizzata" : "he non sincronizzate"}. I dati locali sono al sicuro.`,
      actionLabel: "Riprova",
    };
  }
  return {
    tone: "info" as const,
    message: `${pending} modific${pending === 1 ? "a" : "he"} in sincronizzazione`,
  };
}
