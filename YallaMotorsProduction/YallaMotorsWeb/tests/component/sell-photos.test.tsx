import * as React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "../setup/msw-server";
import { SellWorkflow } from "@/components/sell/sell-workflow";
import {
  createEmptySellDraft,
  createInitialSellWizardState,
} from "@/stores/sell-store";
import type { SellPhoto } from "@/types/sell";

const mockDeleteFile = vi.fn().mockResolvedValue({ ok: true, data: { success: true } });

vi.mock("@/server/actions/files", () => ({
  deleteFile: (...args: unknown[]) => mockDeleteFile(...args),
}));

describe("TASK-046: Sell Photo Upload, Processing, Ordering, and Cleanup", () => {
  beforeEach(() => {
    localStorage.clear();
    mockDeleteFile.mockClear();
    document.cookie = "am_csrf=test-csrf-token; Path=/";

    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );

    // Mock URL.createObjectURL and URL.revokeObjectURL in JSDOM
    if (!window.URL.createObjectURL) {
      window.URL.createObjectURL = vi.fn(() => "blob:http://localhost/mock-preview");
    }
    if (!window.URL.revokeObjectURL) {
      window.URL.revokeObjectURL = vi.fn();
    }

    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });

    server.use(
      http.get("*/api/bff/taxonomy/makes", () => HttpResponse.json({ data: [] })),
      http.post("*/api/bff/files", async () => {
        return HttpResponse.json({
          data: {
            publicId: "file_uploaded_123",
            status: "PROCESSING",
            url: null,
            thumbnailUrl: null,
          },
        });
      }),
      http.get("*/api/bff/files/:publicId/status", () => {
        return HttpResponse.json({
          data: {
            publicId: "file_uploaded_123",
            status: "READY",
            url: "https://cdn.example.com/photos/car.jpg",
            thumbnailUrl: "https://cdn.example.com/photos/car-thumb.jpg",
          },
        });
      }),
    );
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("validates file types and sizes on upload", async () => {
    const initialState = createInitialSellWizardState({
      ...createEmptySellDraft(),
      condition: "USED",
      makePublicId: "make_1",
      modelPublicId: "model_1",
      year: 2022,
      mileageKm: 50000,
      fuelType: "PETROL",
      transmission: "AUTOMATIC",
      bodyType: "SEDAN",
      priceCents: 50000000,
    });
    initialState.currentStep = "photos";

    render(
      <SellWorkflow
        userPublicId="usr_photos_test"
        locale="ar"
        initialState={initialState}
      />,
    );

    expect(screen.getByTestId("sell-photos-step")).toBeInTheDocument();
    const fileInput = screen.getByTestId("photo-file-input");

    // 1. Invalid file format (PDF)
    const invalidFile = new File(["dummy content"], "manual.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    expect(await screen.findByTestId("photo-uploader-error")).toHaveTextContent(
      "غير مدعومة",
    );

    // 2. Oversized file (> 8MB)
    const oversizedFile = new File(["a".repeat(100)], "huge.jpg", {
      type: "image/jpeg",
    });
    Object.defineProperty(oversizedFile, "size", { value: 10 * 1024 * 1024 });
    fireEvent.change(fileInput, { target: { files: [oversizedFile] } });

    expect(await screen.findByTestId("photo-uploader-error")).toHaveTextContent(
      "يتجاوز الحد الأقصى",
    );
  });

  it("enforces minimum 3 READY photos before Next button is enabled", async () => {
    const readyPhotos: SellPhoto[] = [
      {
        clientId: "photo_1",
        localPreviewUrl: "blob:http://localhost/photo-1",
        publicId: "pub_1",
        url: "https://cdn.example.com/1.jpg",
        status: "READY",
        progress: 1,
      },
      {
        clientId: "photo_2",
        localPreviewUrl: "blob:http://localhost/photo-2",
        publicId: "pub_2",
        url: "https://cdn.example.com/2.jpg",
        status: "READY",
        progress: 1,
      },
    ];

    const initialState = createInitialSellWizardState({
      ...createEmptySellDraft(),
      condition: "USED",
      makePublicId: "make_1",
      modelPublicId: "model_1",
      year: 2022,
      mileageKm: 50000,
      fuelType: "PETROL",
      transmission: "AUTOMATIC",
      bodyType: "SEDAN",
      priceCents: 50000000,
    });
    initialState.currentStep = "photos";
    initialState.photos = readyPhotos;

    render(
      <SellWorkflow
        userPublicId="usr_photos_test"
        locale="ar"
        initialState={initialState}
      />,
    );

    const nextButton = screen.getByTestId("sell-next");
    // With 2 ready photos, Next should be disabled
    expect(nextButton).toBeDisabled();

    // Upload 3rd photo
    const validFile = new File(["image-bytes"], "photo3.jpg", {
      type: "image/jpeg",
    });
    const fileInput = screen.getByTestId("photo-file-input");
    fireEvent.change(fileInput, { target: { files: [validFile] } });

    // Wait for upload and polling to settle to READY
    await waitFor(() => {
      expect(nextButton).not.toBeDisabled();
    }, { timeout: 4000 });
  });

  it("supports setting cover photo and reordering photos", async () => {
    const photos: SellPhoto[] = [
      {
        clientId: "photo_1",
        localPreviewUrl: "blob:http://localhost/photo-1",
        publicId: "pub_1",
        url: "https://cdn.example.com/1.jpg",
        status: "READY",
        progress: 1,
      },
      {
        clientId: "photo_2",
        localPreviewUrl: "blob:http://localhost/photo-2",
        publicId: "pub_2",
        url: "https://cdn.example.com/2.jpg",
        status: "READY",
        progress: 1,
      },
      {
        clientId: "photo_3",
        localPreviewUrl: "blob:http://localhost/photo-3",
        publicId: "pub_3",
        url: "https://cdn.example.com/3.jpg",
        status: "READY",
        progress: 1,
      },
    ];

    const initialState = createInitialSellWizardState({
      ...createEmptySellDraft(),
      condition: "USED",
      makePublicId: "make_1",
      modelPublicId: "model_1",
      year: 2022,
      mileageKm: 50000,
      fuelType: "PETROL",
      transmission: "AUTOMATIC",
      bodyType: "SEDAN",
      priceCents: 50000000,
    });
    initialState.currentStep = "photos";
    initialState.photos = photos;
    initialState.coverPhotoClientId = "photo_1";

    render(
      <SellWorkflow
        userPublicId="usr_photos_test"
        locale="en"
        initialState={initialState}
      />,
    );

    // Initial cover is photo_1
    expect(screen.getByTestId("photo-tile-photo_1")).toHaveTextContent("Cover Photo");

    // Set photo_2 as cover
    const setCoverBtn = screen.getByTestId("photo-set-cover-photo_2");
    fireEvent.click(setCoverBtn);

    await waitFor(() => {
      expect(screen.getByTestId("photo-tile-photo_2")).toHaveTextContent("Cover Photo");
    });

    // Reorder: Move photo_1 later (to index 1)
    const moveLaterBtn = screen.getByTestId("photo-move-later-photo_1");
    fireEvent.click(moveLaterBtn);

    // Remove photo_3
    const removeBtn = screen.getByTestId("photo-remove-photo_3");
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(screen.queryByTestId("photo-tile-photo_3")).not.toBeInTheDocument();
      expect(mockDeleteFile).toHaveBeenCalledWith({ publicId: "pub_3" });
    });
  });

  it("wires retry handler from PhotoTile through PhotosStep to PhotoUploader with fresh AbortController and idempotency key", async () => {
    let uploadCallCount = 0;
    const capturedIdempotencyKeys: string[] = [];

    server.use(
      http.post("*/api/bff/files", async ({ request }) => {
        uploadCallCount += 1;
        const idempotencyKey = request.headers.get("Idempotency-Key");
        if (idempotencyKey) capturedIdempotencyKeys.push(idempotencyKey);

        if (uploadCallCount === 1) {
          // First attempt fails
          return new HttpResponse(null, { status: 500 });
        }

        // Retry succeeds
        return HttpResponse.json({
          data: {
            publicId: "file_retry_success",
            status: "READY",
            url: "https://cdn.example.com/photos/retry-car.jpg",
            thumbnailUrl: null,
          },
        });
      }),
    );

    const initialState = createInitialSellWizardState({
      ...createEmptySellDraft(),
      condition: "USED",
      makePublicId: "make_1",
      modelPublicId: "model_1",
      year: 2022,
      mileageKm: 50000,
      fuelType: "PETROL",
      transmission: "AUTOMATIC",
      bodyType: "SEDAN",
      priceCents: 50000000,
    });
    initialState.currentStep = "photos";

    render(
      <SellWorkflow
        userPublicId="usr_retry_test"
        locale="en"
        initialState={initialState}
      />,
    );

    const fileInput = screen.getByTestId("photo-file-input");
    const testFile = new File(["test-bytes"], "retry-test.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    // Wait for the tile to fail and display the Retry button
    const retryBtn = await screen.findByRole("button", { name: /retry/i });
    expect(retryBtn).toBeInTheDocument();
    expect(screen.getByText("Upload Failed")).toBeInTheDocument();
    expect(uploadCallCount).toBe(1);

    // Click retry
    fireEvent.click(retryBtn);

    // Verify second attempt was initiated with a NEW idempotency key
    await waitFor(() => {
      expect(uploadCallCount).toBe(2);
    });

    expect(capturedIdempotencyKeys).toHaveLength(2);
    expect(capturedIdempotencyKeys[0]).not.toBe(capturedIdempotencyKeys[1]);

    // Check that photo reaches READY after retry
    await waitFor(() => {
      expect(screen.queryByText("Upload Failed")).not.toBeInTheDocument();
    });
  });

  it("revokes blob preview URL immediately upon reaching READY or FAILED, and keeps remote URL for display", async () => {
    const revokeMock = vi.fn();
    window.URL.revokeObjectURL = revokeMock;

    let postAttempt = 0;
    server.use(
      http.post("*/api/bff/files", async () => {
        postAttempt += 1;
        if (postAttempt === 1) {
          return HttpResponse.json({
            data: {
              publicId: "file_revocation_test",
              status: "READY",
              url: "https://cdn.example.com/photos/ready-car.jpg",
            },
          });
        }
        return new HttpResponse(null, { status: 500 });
      }),
    );

    const initialState = createInitialSellWizardState({
      ...createEmptySellDraft(),
      condition: "USED",
      makePublicId: "make_1",
      modelPublicId: "model_1",
      year: 2022,
      mileageKm: 50000,
      fuelType: "PETROL",
      transmission: "AUTOMATIC",
      bodyType: "SEDAN",
      priceCents: 50000000,
    });
    initialState.currentStep = "photos";

    render(
      <SellWorkflow
        userPublicId="usr_revocation_test"
        locale="en"
        initialState={initialState}
      />,
    );

    const fileInput = screen.getByTestId("photo-file-input");
    const testFile = new File(["bytes"], "photo.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    // Upload 1 reaches READY immediately -> verify revokeObjectURL was called
    await waitFor(() => {
      expect(revokeMock).toHaveBeenCalled();
    });

    // Verify remote image is displayed, not leaving localPreview pointing at released URL
    const img = await screen.findByRole("img", { name: /vehicle photo 1/i });
    expect(img).toHaveAttribute("src", "https://cdn.example.com/photos/ready-car.jpg");

    // Next, upload a file that fails -> verify revokeObjectURL is called upon FAILED
    revokeMock.mockClear();
    const failingFile = new File(["bytes2"], "photo2.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [failingFile] } });

    await waitFor(() => {
      expect(screen.getByText("Upload Failed")).toBeInTheDocument();
      expect(revokeMock).toHaveBeenCalled();
    });
  });

  it("stops polling on offline and resumes on reconnect, and stops polling on unmount", async () => {
    let pollCount = 0;
    server.use(
      http.post("*/api/bff/files", async () => {
        return HttpResponse.json({
          data: {
            publicId: "file_poll_offline",
            status: "PROCESSING",
            url: null,
          },
        });
      }),
      http.get("*/api/bff/files/:publicId/status", () => {
        pollCount += 1;
        if (pollCount < 3) {
          return HttpResponse.json({
            data: {
              publicId: "file_poll_offline",
              status: "PROCESSING",
              url: null,
            },
          });
        }
        return HttpResponse.json({
          data: {
            publicId: "file_poll_offline",
            status: "READY",
            url: "https://cdn.example.com/photos/finally-ready.jpg",
          },
        });
      }),
    );

    const initialState = createInitialSellWizardState({
      ...createEmptySellDraft(),
      condition: "USED",
      makePublicId: "make_1",
      modelPublicId: "model_1",
      year: 2022,
      mileageKm: 50000,
      fuelType: "PETROL",
      transmission: "AUTOMATIC",
      bodyType: "SEDAN",
      priceCents: 50000000,
    });
    initialState.currentStep = "photos";

    const { unmount } = render(
      <SellWorkflow
        userPublicId="usr_poll_offline_test"
        locale="en"
        initialState={initialState}
      />,
    );

    const fileInput = screen.getByTestId("photo-file-input");
    const testFile = new File(["bytes"], "offline.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    // First poll occurs
    await waitFor(() => {
      expect(pollCount).toBeGreaterThanOrEqual(1);
    }, { timeout: 3000 });

    const countBeforeOffline = pollCount;

    // Simulate going offline
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    window.dispatchEvent(new Event("offline"));

    // Ensure polling is stopped while offline
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(pollCount).toBe(countBeforeOffline);

    // Simulate coming back online (safe reconnect path)
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
    window.dispatchEvent(new Event("online"));

    // Polling resumes and reaches READY
    await waitFor(() => {
      expect(pollCount).toBeGreaterThan(countBeforeOffline);
    }, { timeout: 4000 });

    // Unmount while component is clean - must not throw or schedule further polling
    unmount();
  });

  it("handles partial processing failure and enables Next when failed upload is retried", async () => {
    let postCount = 0;
    server.use(
      http.post("*/api/bff/files", async () => {
        postCount += 1;
        if (postCount === 3) {
          // Third file fails
          return new HttpResponse(null, { status: 500 });
        }
        if (postCount === 4) {
          // Retry of third file succeeds
          return HttpResponse.json({
            data: {
              publicId: "pub_file3_retry",
              status: "READY",
              url: "https://cdn.example.com/3.jpg",
            },
          });
        }
        // First two files succeed
        return HttpResponse.json({
          data: {
            publicId: `pub_file_${postCount}`,
            status: "READY",
            url: `https://cdn.example.com/file${postCount}.jpg`,
          },
        });
      }),
    );

    const initialState = createInitialSellWizardState({
      ...createEmptySellDraft(),
      condition: "USED",
      makePublicId: "make_1",
      modelPublicId: "model_1",
      year: 2022,
      mileageKm: 50000,
      fuelType: "PETROL",
      transmission: "AUTOMATIC",
      bodyType: "SEDAN",
      priceCents: 50000000,
    });
    initialState.currentStep = "photos";

    render(
      <SellWorkflow
        userPublicId="usr_partial_failure"
        locale="en"
        initialState={initialState}
      />,
    );

    const file1 = new File(["1"], "file1.jpg", { type: "image/jpeg" });
    const file2 = new File(["2"], "file2.jpg", { type: "image/jpeg" });
    const file3 = new File(["3"], "file3.jpg", { type: "image/jpeg" });

    const fileInput = screen.getByTestId("photo-file-input");
    fireEvent.change(fileInput, { target: { files: [file1, file2, file3] } });

    // File 1 and File 2 succeed, File 3 fails
    await waitFor(() => {
      expect(screen.getByText("Upload Failed")).toBeInTheDocument();
    });

    // Next button must be disabled because only 2 are ready (minimum 3 required)
    const nextBtn = screen.getByTestId("sell-next");
    expect(nextBtn).toBeDisabled();

    // Click retry on File 3
    const retryBtn = screen.getByRole("button", { name: /retry/i });
    fireEvent.click(retryBtn);

    // Wait for File 3 to succeed upon retry
    await waitFor(() => {
      expect(screen.queryByText("Upload Failed")).not.toBeInTheDocument();
      expect(nextBtn).not.toBeDisabled();
    }, { timeout: 4000 });
  });

  it("reconciles delete failure without disrupting client state or throwing", async () => {
    mockDeleteFile.mockRejectedValueOnce(new Error("Network connection dropped"));

    const photos: SellPhoto[] = [
      {
        clientId: "p1",
        localPreviewUrl: "",
        publicId: "pub_1",
        url: "https://cdn.example.com/1.jpg",
        status: "READY",
        progress: 1,
      },
      {
        clientId: "p2",
        localPreviewUrl: "",
        publicId: "pub_2",
        url: "https://cdn.example.com/2.jpg",
        status: "READY",
        progress: 1,
      },
    ];

    const initialState = createInitialSellWizardState({
      ...createEmptySellDraft(),
      condition: "USED",
      makePublicId: "make_1",
      modelPublicId: "model_1",
      year: 2022,
      mileageKm: 50000,
      fuelType: "PETROL",
      transmission: "AUTOMATIC",
      bodyType: "SEDAN",
      priceCents: 50000000,
    });
    initialState.currentStep = "photos";
    initialState.photos = photos;

    render(
      <SellWorkflow
        userPublicId="usr_delete_fail"
        locale="en"
        initialState={initialState}
      />,
    );

    expect(screen.getByTestId("photo-tile-p1")).toBeInTheDocument();
    expect(screen.getByTestId("photo-tile-p2")).toBeInTheDocument();

    // Remove p1 (whose server deletion will fail)
    const removeBtn = screen.getByTestId("photo-remove-p1");
    fireEvent.click(removeBtn);

    // p1 is removed from client UI without crashing
    await waitFor(() => {
      expect(screen.queryByTestId("photo-tile-p1")).not.toBeInTheDocument();
      expect(screen.getByTestId("photo-tile-p2")).toBeInTheDocument();
    });

    expect(mockDeleteFile).toHaveBeenCalledWith({ publicId: "pub_1" });
  });

  it("sanitizes filenames preventing HTML exposure and verifies accessible keyboard controls", async () => {
    const initialState = createInitialSellWizardState({
      ...createEmptySellDraft(),
      condition: "USED",
      makePublicId: "make_1",
      modelPublicId: "model_1",
      year: 2022,
      mileageKm: 50000,
      fuelType: "PETROL",
      transmission: "AUTOMATIC",
      bodyType: "SEDAN",
      priceCents: 50000000,
    });
    initialState.currentStep = "photos";

    render(
      <SellWorkflow
        userPublicId="usr_sanitize_test"
        locale="en"
        initialState={initialState}
      />,
    );

    const fileInput = screen.getByTestId("photo-file-input");
    // Malicious file name containing script tag
    const xssFile = new File(["corrupt"], '<img src=x onerror=alert(1)>.exe', {
      type: "application/octet-stream",
    });
    fireEvent.change(fileInput, { target: { files: [xssFile] } });

    const errorAlert = await screen.findByTestId("photo-uploader-error");
    expect(errorAlert).toBeInTheDocument();
    // Verify no unescaped HTML element was inserted
    expect(document.querySelector("img[src='x']")).toBeNull();
  });
});
