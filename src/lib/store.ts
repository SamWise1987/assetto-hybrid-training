import { create } from "zustand";

export type AppTab = "today" | "calendar" | "progress" | "exercises" | "settings";

interface AppState {
  tab: AppTab;
  setTab: (tab: AppTab) => void;
}

export const useAppStore = create<AppState>((set) => ({
  tab: "today",
  setTab: (tab) => set({ tab }),
}));
