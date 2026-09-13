import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SELL_DRAFT_VERSION,
  SELL_STEPS,
  createEmptySellDraft,
  createInitialSellWizardState,
  createSellStore,
  getSellDraftStorageKey,
  hashSellDraftUserPublicId,
  isSellStepComplete,
  readPersistedSellDraft,
  type SellDraftStorage,
} from "@/stores/sell-store";
import type { SellListingDraft, SellPhoto } from "@/types/sell";

class MemoryStorage implements SellDraftStorage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }
}

function completeDraft(): SellListingDraft {
  return {
    ...createEmptySellDraft(),
    condition: "USED",
    makePublicId: "make_1",
    modelPublicId: "model_1",
    generationPublicId: "generation_1",
    trimPublicId: "trim_1",
    year: 2024,
    mileageKm: 12_000,
    fuelType: "PETROL",
    transmission: "AUTOMATIC",
    bodyType: "SEDAN",
    priceCents: 2_500_000,
    cityId: 1,
    areaId: 2,
  };
}

function readyPhoto(index: number): SellPhoto {
  return {
    clientId: `client_${index}`,
    localPreviewUrl: `blob:https://cars.example/${index}`,
    publicId: `file_${index}`,
    url: `https://cdn.example/${index}.jpg`,
    status: "READY",
    progress: 1,
  };
}

describe("TASK-043: route-scoped sell store", () => {
  afterEach(() => vi.restoreAllMocks());

  it("enforces every ordered transition and rejects incomplete forward jumps", async () => {
    const store = createSellStore({ userPublicId: "usr_steps" });
    expect(store.getState().goToStep("review")).toBe(false);
    expect(store.getState().nextStep()).toBe(false);
    expect(store.getState().errorCode).toBe("STEP_INCOMPLETE");

    expect(store.getState().setCondition("USED")).toBe(true);
    expect(store.getState().nextStep()).toBe(true);
    expect(store.getState().currentStep).toBe("vehicle");
    expect(store.getState().nextStep()).toBe(false);
    await Promise.resolve();

    expect(store.getState().selectMake("make_1")).toBe(true);
    expect(store.getState().selectModel("model_1")).toBe(true);
    expect(store.getState().updateDraft({ year: 2024 })).toBe(true);
    expect(store.getState().nextStep()).toBe(true);
    await Promise.resolve();
    expect(store.getState().currentStep).toBe("details");

    store.getState().updateDraft({
      mileageKm: 10,
      fuelType: "PETROL",
      transmission: "AUTOMATIC",
      bodyType: "SEDAN",
    });
    expect(store.getState().nextStep()).toBe(true);
    await Promise.resolve();
    store.getState().updateDraft({ priceCents: 100_000 });
    expect(store.getState().nextStep()).toBe(true);
    await Promise.resolve();
    expect(store.getState().currentStep).toBe("photos");

    for (let index = 1; index <= 3; index += 1) {
      expect(store.getState().addPhoto(readyPhoto(index))).toBe(true);
    }
    expect(store.getState().nextStep()).toBe(true);
    await Promise.resolve();
    store.getState().updateDraft({ cityId: 1 });
    expect(store.getState().nextStep()).toBe(true);
    await Promise.resolve();
    expect(store.getState().currentStep).toBe("review");
    expect(store.getState().nextStep()).toBe(false);
    expect(isSellStepComplete(store.getState(), "review")).toBe(true);
    store.destroySellStore();
  });

  it("clears invalid taxonomy/location descendants without clearing photos", () => {
    const state = createInitialSellWizardState(completeDraft());
    state.photos = [readyPhoto(1)];
    state.coverPhotoClientId = "client_1";
    const store = createSellStore({
      userPublicId: "usr_hierarchy",
      initialState: state,
    });

    expect(store.getState().selectMake("make_2")).toBe(true);
    expect(store.getState().draft).toEqual(
      expect.objectContaining({
        makePublicId: "make_2",
        modelPublicId: null,
        generationPublicId: null,
        trimPublicId: null,
        year: null,
      }),
    );
    expect(store.getState().photos).toHaveLength(1);
    expect(store.getState().coverPhotoClientId).toBe("client_1");
    expect(store.getState().selectGeneration("generation_2")).toBe(false);
    expect(store.getState().selectArea(9)).toBe(true);
    expect(store.getState().selectCity(3)).toBe(true);
    expect(store.getState().draft.areaId).toBeNull();

    store.getState().selectCity(null);
    expect(store.getState().selectArea(7)).toBe(false);
    store.destroySellStore();
  });

  it("persists only the schema-valid draft in a versioned hashed account key", () => {
    const storage = new MemoryStorage();
    const store = createSellStore({
      userPublicId: "usr_private_123",
      storage,
    });
    store.getState().hydrate(storage);
    store.getState().setCondition("NEW");
    store.getState().addPhoto(readyPhoto(1));

    const key = getSellDraftStorageKey("usr_private_123");
    expect(key).toContain(`:v${SELL_DRAFT_VERSION}`);
    expect(key).not.toContain("usr_private_123");
    const raw = storage.getItem(key)!;
    const payload = JSON.parse(raw) as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual([
      "draft",
      "userHash",
      "version",
    ]);
    expect(raw).not.toContain("blob:");
    expect(raw).not.toContain("file_1");
    expect(raw).not.toContain("token");
    expect(
      readPersistedSellDraft(storage, "usr_private_123")?.draft.condition,
    ).toBe("NEW");
    store.destroySellStore();
  });

  it("offers explicit restore/discard while preserving the server seed before consent", () => {
    const storage = new MemoryStorage();
    const first = createSellStore({ userPublicId: "usr_restore", storage });
    first.getState().hydrate(storage);
    first.getState().setCondition("USED");

    const second = createSellStore({ userPublicId: "usr_restore", storage });
    expect(second.getState().isHydrated).toBe(false);
    expect(second.getState().draft.condition).toBeNull();
    second.getState().hydrate(storage);
    expect(second.getState().draft.condition).toBeNull();
    expect(second.getState().recoveryDraft?.condition).toBe("USED");
    second.getState().restoreDraft();
    expect(second.getState().draft.condition).toBe("USED");
    expect(second.getState().recoveryDraft).toBeNull();

    const third = createSellStore({ userPublicId: "usr_restore", storage });
    third.getState().hydrate(storage);
    third.getState().discardDraft();
    expect(storage.getItem(getSellDraftStorageKey("usr_restore"))).toBeNull();
    first.destroySellStore();
    second.destroySellStore();
    third.destroySellStore();
  });

  it("isolates accounts and deterministically discards corrupt/current and obsolete versions", () => {
    const storage = new MemoryStorage();
    const userA = "usr_account_a";
    const userB = "usr_account_b";
    const storeA = createSellStore({ userPublicId: userA, storage });
    storeA.getState().hydrate(storage);
    storeA.getState().setCondition("USED");

    const storeB = createSellStore({ userPublicId: userB, storage });
    storeB.getState().hydrate(storage);
    expect(storeB.getState().recoveryDraft).toBeNull();
    expect(storeB.getState().draft.condition).toBeNull();

    const hashB = hashSellDraftUserPublicId(userB);
    const obsoleteKey = `arabiyatmart:sell-draft:${hashB}:v0`;
    storage.setItem(
      obsoleteKey,
      JSON.stringify({ version: 0, draft: completeDraft() }),
    );
    storage.setItem(getSellDraftStorageKey(userB), "{corrupt-json");
    const afterCorruption = createSellStore({ userPublicId: userB, storage });
    afterCorruption.getState().hydrate(storage);
    expect(storage.getItem(obsoleteKey)).toBeNull();
    expect(storage.getItem(getSellDraftStorageKey(userB))).toBeNull();
    expect(storage.getItem(getSellDraftStorageKey(userA))).not.toBeNull();
    storeA.destroySellStore();
    storeB.destroySellStore();
    afterCorruption.destroySellStore();
  });

  it("revokes each preview exactly once on replacement, removal, and store teardown", () => {
    const revoke = vi.fn();
    const store = createSellStore({
      userPublicId: "usr_photos",
      revokeObjectURL: revoke,
    });
    store.getState().addPhoto(readyPhoto(1));
    store.getState().updatePhoto("client_1", {
      localPreviewUrl: "blob:https://cars.example/replaced",
    });
    expect(revoke).toHaveBeenCalledWith("blob:https://cars.example/1");
    store.getState().removePhoto("client_1");
    expect(revoke).toHaveBeenCalledWith("blob:https://cars.example/replaced");
    store.getState().addPhoto(readyPhoto(2));
    store.destroySellStore();
    expect(revoke).toHaveBeenCalledWith("blob:https://cars.example/2");
    expect(revoke).toHaveBeenCalledTimes(3);
  });

  it("locks rapid next/back and blocks navigation during validation or submission", async () => {
    const initial = createInitialSellWizardState(completeDraft());
    const store = createSellStore({
      userPublicId: "usr_navigation",
      initialState: initial,
    });
    expect(store.getState().nextStep()).toBe(true);
    expect(store.getState().nextStep()).toBe(false);
    expect(store.getState().currentStep).toBe("vehicle");
    await Promise.resolve();
    expect(store.getState().nextStep()).toBe(true);
    await Promise.resolve();
    expect(store.getState().currentStep).toBe("details");
    expect(store.getState().previousStep()).toBe(true);
    expect(store.getState().previousStep()).toBe(false);
    await Promise.resolve();
    expect(store.getState().currentStep).toBe("vehicle");

    store.getState().setTransitionPending(true);
    expect(store.getState().nextStep()).toBe(false);
    expect(store.getState().previousStep()).toBe(false);
    store.getState().setTransitionPending(false);
    store.getState().setSubmitting(true);
    expect(store.getState().nextStep()).toBe(false);
    store.destroySellStore();
  });

  it("reset clears storage, workflow state, errors, and photos", () => {
    const storage = new MemoryStorage();
    const store = createSellStore({ userPublicId: "usr_reset", storage });
    store.getState().hydrate(storage);
    store.getState().setCondition("USED");
    store.getState().addPhoto(readyPhoto(1));
    store.getState().nextStep();
    store.getState().reset();

    expect(store.getState().currentStep).toBe(SELL_STEPS[0]);
    expect(store.getState().draft).toEqual(createEmptySellDraft());
    expect(store.getState().photos).toEqual([]);
    expect(store.getState().isDirty).toBe(false);
    expect(storage.getItem(getSellDraftStorageKey("usr_reset"))).toBeNull();
    store.destroySellStore();
  });

  it("TASK 2.3: namespaces saved drafts by listing scope and isolates personal from dealer drafts", () => {
    const storage = new MemoryStorage();
    const userId = "usr_scope_demo";

    // 1. Personal store saves a draft
    const personalStore = createSellStore({
      userPublicId: userId,
      scopeId: "personal",
      storage,
    });
    personalStore.getState().hydrate(storage);
    personalStore.getState().setCondition("USED");
    personalStore.getState().updateDraft({ priceCents: 500_000 });

    const personalKey = getSellDraftStorageKey(userId, "personal");
    expect(personalKey).toContain(":personal:v1");
    expect(storage.getItem(personalKey)).not.toBeNull();

    // 2. Dealership store for vendor A
    const dealerStoreA = createSellStore({
      userPublicId: userId,
      scopeId: "vnd_dealer_alpha",
      storage,
    });
    dealerStoreA.getState().hydrate(storage);
    // Dealer workflow must NOT see personal draft
    expect(dealerStoreA.getState().draft.condition).toBeNull();
    expect(dealerStoreA.getState().recoveryDraft).toBeNull();

    // Dealer saves their own draft
    dealerStoreA.getState().setCondition("NEW");
    dealerStoreA.getState().updateDraft({ priceCents: 1_200_000 });

    const dealerKeyA = getSellDraftStorageKey(userId, "vnd_dealer_alpha");
    expect(dealerKeyA).toContain(":vnd_dealer_alpha:v1");
    expect(storage.getItem(dealerKeyA)).not.toBeNull();

    // 3. Dealership store for vendor B must not see vendor A or personal drafts
    const dealerStoreB = createSellStore({
      userPublicId: userId,
      scopeId: "vnd_dealer_beta",
      storage,
    });
    dealerStoreB.getState().hydrate(storage);
    expect(dealerStoreB.getState().draft.condition).toBeNull();
    expect(dealerStoreB.getState().recoveryDraft).toBeNull();

    // 4. Switching scope dynamically via setScopeId loads that scope's draft
    personalStore.getState().setScopeId("vnd_dealer_alpha");
    expect(personalStore.getState().draft.condition).toBe("NEW");
    expect(personalStore.getState().draft.priceCents).toBe(1_200_000);

    personalStore.getState().setScopeId("personal");
    expect(personalStore.getState().draft.condition).toBe("USED");
    expect(personalStore.getState().draft.priceCents).toBe(500_000);

    personalStore.destroySellStore();
    dealerStoreA.destroySellStore();
    dealerStoreB.destroySellStore();
  });

  it("TASK 2.3: migrates legacy unnamespaced draft for personal scope seamlessly", () => {
    const storage = new MemoryStorage();
    const userId = "usr_legacy_mig";
    const userHash = hashSellDraftUserPublicId(userId);

    // Save under old legacy key without scope
    const legacyKey = `arabiyatmart:sell-draft:${userHash}:v1`;
    storage.setItem(
      legacyKey,
      JSON.stringify({
        version: 1,
        userHash,
        draft: { ...createEmptySellDraft(), condition: "USED", year: 2023 },
      })
    );

    // Reading under personal scope finds legacy draft
    const read = readPersistedSellDraft(storage, userId, "personal");
    expect(read).not.toBeNull();
    expect(read?.draft.condition).toBe("USED");
    expect(read?.draft.year).toBe(2023);

    // Reading under dealer scope does NOT find legacy draft
    const dealerRead = readPersistedSellDraft(storage, userId, "vnd_dealer_xyz");
    expect(dealerRead).toBeNull();
  });
});

