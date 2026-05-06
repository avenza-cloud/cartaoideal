"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserProfile } from "@/types/cards";

const MAX_COMPARE = 4;

interface CompareStore {
  ids: string[];
  add: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  canAdd: () => boolean;
}

export const useCompareStore = create<CompareStore>((set, get) => ({
  ids: [],
  add: (id) =>
    set((state) => {
      if (state.ids.length >= MAX_COMPARE || state.ids.includes(id))
        return state;
      return { ids: [...state.ids, id] };
    }),
  remove: (id) =>
    set((state) => ({ ids: state.ids.filter((i) => i !== id) })),
  clear: () => set({ ids: [] }),
  canAdd: () => get().ids.length < MAX_COMPARE,
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
