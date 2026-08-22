"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserProfile } from "@/types/cards";

const MAX_COMPARE = 4;

/** Cards are added from contexts that already hold them, so the bar can show
 * names without ever needing the catalog client-side. */
export interface CompareItem {
  id: string;
  name: string;
}

interface CompareStore {
  items: CompareItem[];
  ids: string[];
  add: (item: CompareItem) => void;
  remove: (id: string) => void;
  clear: () => void;
  canAdd: () => boolean;
}

export const useCompareStore = create<CompareStore>((set, get) => ({
  items: [],
  ids: [],
  add: (item) =>
    set((state) => {
      if (state.items.length >= MAX_COMPARE || state.ids.includes(item.id)) return state;
      const items = [...state.items, item];
      return { items, ids: items.map((i) => i.id) };
    }),
  remove: (id) =>
    set((state) => {
      const items = state.items.filter((i) => i.id !== id);
      return { items, ids: items.map((i) => i.id) };
    }),
  clear: () => set({ items: [], ids: [] }),
  canAdd: () => get().items.length < MAX_COMPARE,
}));

interface ProfileStore {
  profile: UserProfile | null;
  onboardingDone: boolean;
  setProfile: (profile: UserProfile) => void;
  skipOnboarding: () => void;
  resetOnboarding: () => void;
}

export const useProfileStore = create<ProfileStore>()(
  persist(
    (set) => ({
      profile: null,
      onboardingDone: false,
      setProfile: (profile) => set({ profile, onboardingDone: true }),
      skipOnboarding: () => set({ onboardingDone: true, profile: null }),
      resetOnboarding: () => set({ onboardingDone: false, profile: null }),
    }),
    { name: "credit-card-profile" }
  )
);
