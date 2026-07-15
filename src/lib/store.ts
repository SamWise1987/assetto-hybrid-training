import { create } from "zustand";

export type AppTab = "today" | "calendar" | "progress" | "analysis" | "exercises" | "clients" | "coach" | "inbox" | "settings";

interface PlanNotice {
  planName: string;
  changedAt: string;
  kind: "assigned" | "updated";
  reason?: string;
}

interface AppState {
  tab: AppTab;
  setTab: (tab: AppTab) => void;
  planNotice: PlanNotice | null;
  setPlanNotice: (notice: PlanNotice | null) => void;
  integrationMessage: string | null;
  setIntegrationMessage: (message: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  tab: "today",
  setTab: (tab) => set({ tab }),
  planNotice: null,
  setPlanNotice: (planNotice) => set({ planNotice }),
  integrationMessage: null,
  setIntegrationMessage: (integrationMessage) => set({ integrationMessage }),
}));
