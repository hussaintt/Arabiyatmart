import { create } from 'zustand';
import type { CompareItemKind, CompareItemRef } from '@/types/compare';

export interface CompareState {
  mode: CompareItemKind | null;
  items: CompareItemRef[];
  isPickerOpen: boolean;
  activeSlotIndex: number | null;
  pendingSelection: CompareItemRef | null;
  searchQuery: string;
  setInitialState: (items: CompareItemRef[], mode: CompareItemKind | null) => void;
  openPicker: (slotIndex?: number) => void;
  closePicker: () => void;
  setSearchQuery: (query: string) => void;
  setPendingSelection: (item: CompareItemRef | null) => void;
  reset: () => void;
}

export const useCompareStore = create<CompareState>((set) => ({
  mode: null,
  items: [],
  isPickerOpen: false,
  activeSlotIndex: null,
  pendingSelection: null,
  searchQuery: '',

  setInitialState: (items, mode) =>
    set({
      items,
      mode,
      isPickerOpen: false,
      activeSlotIndex: null,
      pendingSelection: null,
      searchQuery: '',
    }),

  openPicker: (slotIndex) =>
    set({
      isPickerOpen: true,
      activeSlotIndex: slotIndex ?? null,
      pendingSelection: null,
      searchQuery: '',
    }),

  closePicker: () =>
    set({
      isPickerOpen: false,
      activeSlotIndex: null,
      pendingSelection: null,
      searchQuery: '',
    }),

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  setPendingSelection: (pendingSelection) => set({ pendingSelection }),

  reset: () =>
    set({
      mode: null,
      items: [],
      isPickerOpen: false,
      activeSlotIndex: null,
      pendingSelection: null,
      searchQuery: '',
    }),
}));
