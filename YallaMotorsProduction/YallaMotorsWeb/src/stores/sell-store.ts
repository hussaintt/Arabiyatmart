import { z } from "zod";
import { createStore, type StoreApi } from "zustand/vanilla";
import {
  SellListingDraftSchema,
  SellPhotoSchema,
  SellStepSchema,
  SellWizardStateSchema,
} from "@/lib/api/schemas/sell";
import type {
  SellListingDraft,
  SellPhoto,
  SellStep,
  SellWizardState,
} from "@/types/sell";

export const SELL_DRAFT_VERSION = 1 as const;
export const SELL_STEPS = [
  "condition",
  "vehicle",
  "details",
  "pricing",
  "photos",
  "location",
  "review",
] as const satisfies readonly SellStep[];

export interface SellDraftStorage {
  readonly length: number;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
}

const PersistedSellDraftSchema = z
  .object({
    version: z.literal(SELL_DRAFT_VERSION),
    userHash: z.string().regex(/^[a-f0-9]{8}$/),
    draft: SellListingDraftSchema,
  })
  .strict();

export interface PersistedSellDraft {
  version: typeof SELL_DRAFT_VERSION;
  userHash: string;
  draft: SellListingDraft;
}

export function hashSellDraftUserPublicId(userPublicId: string): string {
  const value = userPublicId.trim();
  if (!value) throw new Error("A user public identifier is required");
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function getSellDraftStorageKey(
  userPublicId: string,
  scopeKey = "personal",
): string {
  const normalizedScope = scopeKey.trim() || "personal";
  return `arabiyatmart:sell-draft:${hashSellDraftUserPublicId(userPublicId)}:${normalizedScope}:v${SELL_DRAFT_VERSION}`;
}

function removeObsoleteDrafts(
  storage: SellDraftStorage,
  userHash: string,
  currentKey: string,
  scopeKey = "personal",
) {
  try {
    const namespacedPattern = new RegExp(
      `^arabiyatmart:sell-draft:${userHash}:${scopeKey}:v(\\d+)$`
    );
    const legacyPattern = new RegExp(
      `^arabiyatmart:sell-draft:${userHash}:v(\\d+)$`
    );
    const obsolete: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key) continue;
      if (namespacedPattern.test(key) && key !== currentKey) {
        obsolete.push(key);
      } else if (
        scopeKey === "personal" &&
        legacyPattern.test(key) &&
        key !== `arabiyatmart:sell-draft:${userHash}:v${SELL_DRAFT_VERSION}`
      ) {
        obsolete.push(key);
      }
    }
    for (const key of obsolete) storage.removeItem(key);
  } catch {
    // Browser storage can be unavailable in private/security-restricted contexts.
  }
}

export function readPersistedSellDraft(
  storage: SellDraftStorage,
  userPublicId: string,
  scopeKey = "personal",
): PersistedSellDraft | null {
  const userHash = hashSellDraftUserPublicId(userPublicId);
  const normalizedScope = scopeKey.trim() || "personal";
  const key = getSellDraftStorageKey(userPublicId, normalizedScope);
  removeObsoleteDrafts(storage, userHash, key, normalizedScope);
  let serialized: string | null = null;
  try {
    serialized = storage.getItem(key);
    // Backward compatibility: if personal scope and key not yet set, check legacy unnamespaced key
    if (!serialized && normalizedScope === "personal") {
      const legacyKey = `arabiyatmart:sell-draft:${userHash}:v${SELL_DRAFT_VERSION}`;
      serialized = storage.getItem(legacyKey);
    }
  } catch {
    return null;
  }
  if (!serialized) return null;
  try {
    const parsed = PersistedSellDraftSchema.parse(JSON.parse(serialized));
    if (parsed.userHash !== userHash) {
      try {
        storage.removeItem(key);
      } catch {
        // The invalid value remains inaccessible, but is never restored.
      }
      return null;
    }
    return parsed;
  } catch {
    try {
      storage.removeItem(key);
      if (normalizedScope === "personal") {
        storage.removeItem(`arabiyatmart:sell-draft:${userHash}:v${SELL_DRAFT_VERSION}`);
      }
    } catch {
      // The invalid value remains inaccessible, but is never restored.
    }
    return null;
  }
}

export function createEmptySellDraft(): SellListingDraft {
  return {
    condition: null,
    makePublicId: null,
    modelPublicId: null,
    generationPublicId: null,
    trimPublicId: null,
    year: null,
    mileageKm: null,
    fuelType: null,
    transmission: null,
    bodyType: null,
    engineCc: null,
    colorExterior: null,
    colorInterior: null,
    features: [],
    description: "",
    priceCents: null,
    isNegotiable: false,
    installmentAvailable: false,
    exchangeAccepted: false,
    hasWarranty: false,
    hasServiceHistory: false,
    cityId: null,
    areaId: null,
    contactPhone: null,
    whatsappPhone: null,
    allowChat: true,
  };
}

export function createInitialSellWizardState(
  draft: SellListingDraft = createEmptySellDraft(),
): SellWizardState {
  return SellWizardStateSchema.parse({
    currentStep: "condition",
    draft,
    photos: [],
    coverPhotoClientId: null,
    isSubmitting: false,
    errorCode: null,
    errorMessage: null,
    createdListing: null,
    isSuccess: false,
  });
}

export function isSellStepComplete(
  state: Pick<SellWizardState, "draft" | "photos">,
  step: SellStep,
): boolean {
  const { draft, photos } = state;
  switch (step) {
    case "condition":
      return draft.condition !== null;
    case "vehicle":
      return (
        draft.makePublicId !== null &&
        draft.modelPublicId !== null &&
        draft.year !== null
      );
    case "details":
      return (
        draft.mileageKm !== null &&
        draft.fuelType !== null &&
        draft.transmission !== null &&
        draft.bodyType !== null
      );
    case "pricing":
      return draft.priceCents !== null && draft.priceCents > 0;
    case "photos": {
      const ready = photos.filter(
        (photo) => photo.status === "READY" && photo.publicId !== null,
      );
      return (
        ready.length >= 3 &&
        ready.length <= 20 &&
        photos.every(
          (photo) =>
            photo.status !== "UPLOADING" && photo.status !== "PROCESSING",
        )
      );
    }
    case "location":
      return (
        draft.cityId !== null &&
        (draft.allowChat ||
          Boolean(draft.contactPhone?.trim()) ||
          Boolean(draft.whatsappPhone?.trim()))
      );
    case "review":
      return SELL_STEPS.slice(0, -1).every((candidate) =>
        isSellStepComplete(state, candidate),
      );
  }
}

export function canNavigateToSellStep(
  state: Pick<SellWizardState, "currentStep" | "draft" | "photos">,
  target: SellStep,
): boolean {
  const currentIndex = SELL_STEPS.indexOf(state.currentStep);
  const targetIndex = SELL_STEPS.indexOf(target);
  if (targetIndex <= currentIndex) return true;
  return SELL_STEPS.slice(0, targetIndex).every((step) =>
    isSellStepComplete(state, step),
  );
}

export interface SellStoreState extends SellWizardState {
  scopeId: string;
  isHydrated: boolean;
  isDirty: boolean;
  isTransitionPending: boolean;
  recoveryDraft: SellListingDraft | null;
}

export interface SellStoreActions {
  hydrate: (storage?: SellDraftStorage) => void;
  setScopeId: (scopeId: string) => void;
  restoreDraft: () => void;
  discardDraft: () => void;
  updateDraft: (patch: Partial<SellListingDraft>) => boolean;
  setCondition: (condition: SellListingDraft["condition"]) => boolean;
  selectMake: (publicId: string | null) => boolean;
  selectModel: (publicId: string | null) => boolean;
  selectGeneration: (publicId: string | null) => boolean;
  selectTrim: (publicId: string | null) => boolean;
  selectCity: (cityId: number | null) => boolean;
  selectArea: (areaId: number | null) => boolean;
  addPhoto: (photo: SellPhoto) => boolean;
  updatePhoto: (clientId: string, patch: Partial<SellPhoto>) => boolean;
  removePhoto: (clientId: string) => void;
  setCoverPhoto: (clientId: string | null) => boolean;
  reorderPhotos: (fromIndex: number, toIndex: number) => boolean;
  nextStep: () => boolean;
  previousStep: () => boolean;
  goToStep: (step: SellStep) => boolean;
  setTransitionPending: (pending: boolean) => void;
  setSubmitting: (submitting: boolean) => void;
  clearError: () => void;
  reset: () => void;
  revokeAllPreviewUrls: () => void;
}

export type SellStore = SellStoreState & SellStoreActions;
export type SellStoreApi = StoreApi<SellStore> & {
  destroySellStore: () => void;
};

interface CreateSellStoreOptions {
  userPublicId: string;
  scopeId?: string | undefined;
  initialState?: SellWizardState | undefined;
  storage?: SellDraftStorage | undefined;
  revokeObjectURL?: ((url: string) => void) | undefined;
}

function sameDraft(left: SellListingDraft, right: SellListingDraft) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function normalizedDraftPatch(
  current: SellListingDraft,
  patch: Partial<SellListingDraft>,
) {
  const next: SellListingDraft = { ...current, ...patch };
  if (
    Object.prototype.hasOwnProperty.call(patch, "makePublicId") &&
    patch.makePublicId !== current.makePublicId
  ) {
    next.modelPublicId = null;
    next.generationPublicId = null;
    next.trimPublicId = null;
    next.year = null;
  } else if (
    Object.prototype.hasOwnProperty.call(patch, "modelPublicId") &&
    patch.modelPublicId !== current.modelPublicId
  ) {
    next.generationPublicId = null;
    next.trimPublicId = null;
  } else if (
    Object.prototype.hasOwnProperty.call(patch, "generationPublicId") &&
    patch.generationPublicId !== current.generationPublicId
  ) {
    next.trimPublicId = null;
  }
  if (
    Object.prototype.hasOwnProperty.call(patch, "cityId") &&
    patch.cityId !== current.cityId
  ) {
    next.areaId = null;
  }
  return SellListingDraftSchema.safeParse(next);
}

export function createSellStore({
  userPublicId,
  scopeId = "personal",
  initialState = createInitialSellWizardState(),
  storage,
  revokeObjectURL,
}: CreateSellStoreOptions): SellStoreApi {
  const seed = SellWizardStateSchema.parse(initialState);
  let currentScopeId = scopeId.trim() || "personal";
  let storageKey = getSellDraftStorageKey(userPublicId, currentScopeId);
  const userHash = hashSellDraftUserPublicId(userPublicId);
  let activeStorage = storage;
  let navigationLocked = false;
  const previewUrls = new Map<string, string>();
  const revoke =
    revokeObjectURL ??
    ((url: string) => {
      if (
        typeof URL !== "undefined" &&
        typeof URL.revokeObjectURL === "function"
      ) {
        URL.revokeObjectURL(url);
      }
    });

  const persist = (draft: SellListingDraft) => {
    if (!activeStorage) return;
    const payload: PersistedSellDraft = {
      version: SELL_DRAFT_VERSION,
      userHash,
      draft,
    };
    try {
      activeStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      // Draft editing remains usable if storage is full or blocked.
    }
  };

  const lockNavigationForTurn = () => {
    navigationLocked = true;
    queueMicrotask(() => {
      navigationLocked = false;
    });
  };

  const store = createStore<SellStore>()((set, get) => ({
    ...seed,
    scopeId: currentScopeId,
    isHydrated: false,
    isDirty: false,
    isTransitionPending: false,
    recoveryDraft: null,

    hydrate: (nextStorage) => {
      if (get().isHydrated) return;
      activeStorage = nextStorage;
      if (!activeStorage && typeof window !== "undefined") {
        try {
          activeStorage = window.localStorage;
        } catch {
          activeStorage = undefined;
        }
      }
      if (!activeStorage) {
        set({ isHydrated: true });
        return;
      }
      const persisted = readPersistedSellDraft(
        activeStorage,
        userPublicId,
        currentScopeId,
      );
      set({
        isHydrated: true,
        recoveryDraft:
          persisted && !sameDraft(persisted.draft, seed.draft)
            ? persisted.draft
            : null,
      });
    },

    setScopeId: (nextScopeId) => {
      const normalized = nextScopeId.trim() || "personal";
      currentScopeId = normalized;
      storageKey = getSellDraftStorageKey(userPublicId, normalized);
      if (!activeStorage && typeof window !== "undefined") {
        try {
          activeStorage = window.localStorage;
        } catch {
          activeStorage = undefined;
        }
      }
      const persisted = activeStorage
        ? readPersistedSellDraft(activeStorage, userPublicId, normalized)
        : null;
      set({
        scopeId: normalized,
        draft: persisted?.draft ?? createEmptySellDraft(),
        recoveryDraft: null,
        isDirty: Boolean(persisted),
      });
    },

    restoreDraft: () => {
      const candidate = get().recoveryDraft;
      if (!candidate) return;
      set({ draft: candidate, recoveryDraft: null, isDirty: true });
      persist(candidate);
    },

    discardDraft: () => {
      try {
        activeStorage?.removeItem(storageKey);
        if (currentScopeId === "personal") {
          activeStorage?.removeItem(
            `arabiyatmart:sell-draft:${userHash}:v${SELL_DRAFT_VERSION}`,
          );
        }
      } catch {
        // Recovery is still discarded from live state.
      }
      set({ recoveryDraft: null });
    },

    updateDraft: (patch) => {
      const parsed = normalizedDraftPatch(get().draft, patch);
      if (!parsed.success) {
        set({
          errorCode: "INVALID_DRAFT",
          errorMessage: "The draft contains invalid values.",
        });
        return false;
      }
      set({
        draft: parsed.data,
        isDirty: true,
        errorCode: null,
        errorMessage: null,
      });
      persist(parsed.data);
      return true;
    },

    setCondition: (condition) => get().updateDraft({ condition }),
    selectMake: (makePublicId) => get().updateDraft({ makePublicId }),
    selectModel: (modelPublicId) =>
      modelPublicId && !get().draft.makePublicId
        ? false
        : get().updateDraft({ modelPublicId }),
    selectGeneration: (generationPublicId) =>
      generationPublicId && !get().draft.modelPublicId
        ? false
        : get().updateDraft({ generationPublicId }),
    selectTrim: (trimPublicId) =>
      trimPublicId && !get().draft.generationPublicId
        ? false
        : get().updateDraft({ trimPublicId }),
    selectCity: (cityId) => get().updateDraft({ cityId }),
    selectArea: (areaId) =>
      areaId && !get().draft.cityId ? false : get().updateDraft({ areaId }),

    addPhoto: (photo) => {
      const parsed = SellPhotoSchema.safeParse(photo);
      if (
        !parsed.success ||
        get().photos.length >= 20 ||
        get().photos.some((item) => item.clientId === photo.clientId)
      ) {
        return false;
      }
      if (parsed.data.localPreviewUrl.startsWith("blob:")) {
        previewUrls.set(parsed.data.clientId, parsed.data.localPreviewUrl);
      }
      set((state) => ({
        photos: [...state.photos, parsed.data],
        isDirty: true,
      }));
      return true;
    },

    updatePhoto: (clientId, patch) => {
      const existing = get().photos.find(
        (photo) => photo.clientId === clientId,
      );
      if (!existing) return false;
      const parsed = SellPhotoSchema.safeParse({
        ...existing,
        ...patch,
        clientId,
      });
      if (!parsed.success) return false;
      if (
        parsed.data.localPreviewUrl !== existing.localPreviewUrl &&
        existing.localPreviewUrl.startsWith("blob:")
      ) {
        revoke(existing.localPreviewUrl);
        previewUrls.delete(clientId);
      }
      if (parsed.data.localPreviewUrl.startsWith("blob:")) {
        previewUrls.set(clientId, parsed.data.localPreviewUrl);
      }
      set((state) => ({
        photos: state.photos.map((photo) =>
          photo.clientId === clientId ? parsed.data : photo,
        ),
        isDirty: true,
      }));
      return true;
    },

    removePhoto: (clientId) => {
      const preview = previewUrls.get(clientId);
      if (preview) revoke(preview);
      previewUrls.delete(clientId);
      set((state) => ({
        photos: state.photos.filter((photo) => photo.clientId !== clientId),
        coverPhotoClientId:
          state.coverPhotoClientId === clientId
            ? null
            : state.coverPhotoClientId,
        isDirty: true,
      }));
    },

    setCoverPhoto: (clientId) => {
      if (
        clientId &&
        !get().photos.some((photo) => photo.clientId === clientId)
      ) {
        return false;
      }
      set({ coverPhotoClientId: clientId, isDirty: true });
      return true;
    },

    reorderPhotos: (fromIndex, toIndex) => {
      const photos = [...get().photos];
      if (
        fromIndex < 0 ||
        fromIndex >= photos.length ||
        toIndex < 0 ||
        toIndex >= photos.length ||
        fromIndex === toIndex
      ) {
        return false;
      }
      const [moved] = photos.splice(fromIndex, 1);
      if (!moved) return false;
      photos.splice(toIndex, 0, moved);
      set({ photos, isDirty: true });
      return true;
    },

    nextStep: () => {
      const state = get();
      const index = SELL_STEPS.indexOf(state.currentStep);
      if (
        navigationLocked ||
        state.isTransitionPending ||
        state.isSubmitting ||
        index >= SELL_STEPS.length - 1
      ) {
        return false;
      }
      if (!isSellStepComplete(state, state.currentStep)) {
        set({
          errorCode: "STEP_INCOMPLETE",
          errorMessage: "Complete the required fields before continuing.",
        });
        return false;
      }
      lockNavigationForTurn();
      set({
        currentStep: SELL_STEPS[index + 1]!,
        errorCode: null,
        errorMessage: null,
      });
      return true;
    },

    previousStep: () => {
      const state = get();
      const index = SELL_STEPS.indexOf(state.currentStep);
      if (
        navigationLocked ||
        state.isTransitionPending ||
        state.isSubmitting ||
        index <= 0
      ) {
        return false;
      }
      lockNavigationForTurn();
      set({
        currentStep: SELL_STEPS[index - 1]!,
        errorCode: null,
        errorMessage: null,
      });
      return true;
    },

    goToStep: (target) => {
      const parsed = SellStepSchema.safeParse(target);
      const state = get();
      if (
        !parsed.success ||
        navigationLocked ||
        state.isTransitionPending ||
        state.isSubmitting ||
        !canNavigateToSellStep(state, parsed.data)
      ) {
        return false;
      }
      lockNavigationForTurn();
      set({
        currentStep: parsed.data,
        errorCode: null,
        errorMessage: null,
      });
      return true;
    },

    setTransitionPending: (isTransitionPending) => set({ isTransitionPending }),
    setSubmitting: (isSubmitting) => set({ isSubmitting }),
    clearError: () => set({ errorCode: null, errorMessage: null }),

    reset: () => {
      get().revokeAllPreviewUrls();
      try {
        activeStorage?.removeItem(storageKey);
        if (currentScopeId === "personal") {
          activeStorage?.removeItem(
            `arabiyatmart:sell-draft:${userHash}:v${SELL_DRAFT_VERSION}`,
          );
        }
      } catch {
        // Reset remains deterministic in live state when storage is blocked.
      }
      navigationLocked = false;
      set({
        ...seed,
        scopeId: currentScopeId,
        isHydrated: true,
        isDirty: false,
        isTransitionPending: false,
        recoveryDraft: null,
      });
    },

    revokeAllPreviewUrls: () => {
      for (const preview of previewUrls.values()) revoke(preview);
      previewUrls.clear();
    },
  }));

  return Object.assign(store, {
    destroySellStore: () => {
      store.getState().revokeAllPreviewUrls();
    },
  });
}
