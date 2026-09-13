"use client";

import * as React from "react";
import { AlertCircle, Camera, UploadCloud } from "lucide-react";
import { useSellStore } from "@/components/sell/sell-workflow";
import { getBrowserCsrfToken } from "@/lib/api/browser";
import { cn } from "@/lib/utils";
import type { AppLocale } from "@/i18n/config";

export interface PhotoUploaderHandle {
  retryUpload: (clientId: string) => void;
  removeFile: (clientId: string) => void;
}

export interface PhotoUploaderProps {
  locale?: AppLocale;
  disabled?: boolean;
  onRegisterRetry?: (retryFn: (clientId: string) => void) => void;
}

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB
const MAX_TOTAL_PHOTOS = 20;
const CONCURRENT_UPLOADS_LIMIT = 3;

export const PhotoUploader = React.forwardRef<PhotoUploaderHandle, PhotoUploaderProps>(
  function PhotoUploader({ locale = "ar", disabled = false, onRegisterRetry }, ref) {
    const photos = useSellStore((state) => state.photos);
    const addPhoto = useSellStore((state) => state.addPhoto);
    const updatePhoto = useSellStore((state) => state.updatePhoto);
    const setCoverPhoto = useSellStore((state) => state.setCoverPhoto);
    const coverPhotoClientId = useSellStore((state) => state.coverPhotoClientId);

    const [isDragOver, setIsDragOver] = React.useState(false);
    const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement | null>(null);

    // Retain underlying File objects by clientId to enable real retry
    const fileMapRef = React.useRef<Map<string, File>>(new Map());

    // Track active blob URLs created for local preview
    const blobUrlsRef = React.useRef<Map<string, string>>(new Map());

    // Upload queue and active worker counter for bounded concurrency (max 3)
    const uploadQueueRef = React.useRef<Array<{ file: File; clientId: string }>>([]);
    const activeUploadCountRef = React.useRef<number>(0);

    // Active upload abort controllers by clientId
    const activeControllersRef = React.useRef<Map<string, AbortController>>(new Map());

    // Active poll abort controllers and timers by clientId
    const activePollControllersRef = React.useRef<Map<string, AbortController>>(new Map());
    const activePollTimersRef = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    // Active poll state for safe reconnection resumption: clientId -> { publicId, attempt }
    const activePollStateRef = React.useRef<Map<string, { publicId: string; attempt: number }>>(
      new Map(),
    );

    // Unmount flag to prevent post-unmount execution
    const isUnmountedRef = React.useRef<boolean>(false);

    const ar = locale === "ar";

    // Revoke a specific blob preview URL immediately
    const revokePreviewUrl = React.useCallback((clientId: string) => {
      const blobUrl = blobUrlsRef.current.get(clientId);
      if (blobUrl) {
        if (typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
          URL.revokeObjectURL(blobUrl);
        }
        blobUrlsRef.current.delete(clientId);
      }
    }, []);

    // Stop and clean up any ongoing poll for a clientId
    const cleanupPoll = React.useCallback((clientId: string) => {
      const timer = activePollTimersRef.current.get(clientId);
      if (timer) {
        clearTimeout(timer);
        activePollTimersRef.current.delete(clientId);
      }
      const controller = activePollControllersRef.current.get(clientId);
      if (controller) {
        controller.abort();
        activePollControllersRef.current.delete(clientId);
      }
      activePollStateRef.current.delete(clientId);
    }, []);

    // Poll status with exponential backoff, stopping on unmount, offline, abort, and terminal states
    const pollFileStatus = React.useCallback(
      (clientId: string, publicId: string, attempt = 1) => {
        if (isUnmountedRef.current) return;

        // Check offline state: pause and do NOT schedule new poll
        const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
        if (isOffline) {
          activePollStateRef.current.set(clientId, { publicId, attempt });
          return;
        }

        // Cancel previous timer and controller if still active
        const prevTimer = activePollTimersRef.current.get(clientId);
        if (prevTimer) {
          clearTimeout(prevTimer);
          activePollTimersRef.current.delete(clientId);
        }
        const prevCtrl = activePollControllersRef.current.get(clientId);
        if (prevCtrl) {
          prevCtrl.abort();
          activePollControllersRef.current.delete(clientId);
        }

        const pollController = new AbortController();
        activePollControllersRef.current.set(clientId, pollController);
        activePollStateRef.current.set(clientId, { publicId, attempt });

        const delays = [500, 1000, 2000, 3000, 5000];
        const delay = delays[Math.min(attempt - 1, delays.length - 1)] ?? 5000;

        const timer = setTimeout(async () => {
          activePollTimersRef.current.delete(clientId);

          if (isUnmountedRef.current || pollController.signal.aborted) {
            return;
          }

          if (typeof navigator !== "undefined" && !navigator.onLine) {
            activePollStateRef.current.set(clientId, { publicId, attempt });
            return;
          }

          try {
            const res = await fetch(`/api/bff/files/${encodeURIComponent(publicId)}/status`, {
              signal: pollController.signal,
            });

            if (isUnmountedRef.current || pollController.signal.aborted) {
              return;
            }

            if (!res.ok) {
              if (attempt < 8) {
                if (typeof navigator !== "undefined" && !navigator.onLine) {
                  activePollStateRef.current.set(clientId, { publicId, attempt: attempt + 1 });
                  return;
                }
                pollFileStatus(clientId, publicId, attempt + 1);
              } else {
                revokePreviewUrl(clientId);
                updatePhoto(clientId, { status: "FAILED", localPreviewUrl: "" });
                cleanupPoll(clientId);
              }
              return;
            }

            const json = await res.json();
            if (isUnmountedRef.current || pollController.signal.aborted) {
              return;
            }

            const status = json?.data?.status ?? json?.status;
            const resolvedUrl = json?.data?.url ?? json?.url;

            if (status === "READY") {
              revokePreviewUrl(clientId);
              updatePhoto(clientId, {
                status: "READY",
                url: resolvedUrl ?? null,
                localPreviewUrl: "",
                progress: 1,
              });
              cleanupPoll(clientId);
            } else if (status === "FAILED") {
              revokePreviewUrl(clientId);
              updatePhoto(clientId, { status: "FAILED", localPreviewUrl: "" });
              cleanupPoll(clientId);
            } else {
              // Still PROCESSING
              if (attempt < 15) {
                if (typeof navigator !== "undefined" && !navigator.onLine) {
                  activePollStateRef.current.set(clientId, { publicId, attempt: attempt + 1 });
                  return;
                }
                pollFileStatus(clientId, publicId, attempt + 1);
              } else {
                revokePreviewUrl(clientId);
                updatePhoto(clientId, { status: "FAILED", localPreviewUrl: "" });
                cleanupPoll(clientId);
              }
            }
          } catch {
            if (isUnmountedRef.current || pollController.signal.aborted) {
              return;
            }
            if (typeof navigator !== "undefined" && !navigator.onLine) {
              activePollStateRef.current.set(clientId, { publicId, attempt });
              return;
            }
            if (attempt < 8) {
              pollFileStatus(clientId, publicId, attempt + 1);
            } else {
              revokePreviewUrl(clientId);
              updatePhoto(clientId, { status: "FAILED", localPreviewUrl: "" });
              cleanupPoll(clientId);
            }
          }
        }, delay);

        activePollTimersRef.current.set(clientId, timer);
      },
      [cleanupPoll, revokePreviewUrl, updatePhoto],
    );

    // Upload a single file with fresh AbortController and fresh idempotency key
    const uploadFileTask = React.useCallback(
      async (file: File, clientId: string) => {
        if (isUnmountedRef.current) return;

        const controller = new AbortController();
        activeControllersRef.current.set(clientId, controller);

        updatePhoto(clientId, { status: "UPLOADING", progress: 0.1 });

        const formData = new FormData();
        formData.append("file", file);

        try {
          const csrf = getBrowserCsrfToken();
          if (!csrf) throw new Error("The security token is missing");
          const response = await fetch("/api/bff/files?purpose=LISTING_IMAGE", {
            method: "POST",
            body: formData,
            headers: {
              "Idempotency-Key": crypto.randomUUID(),
              "X-CSRF-Token": csrf,
            },
            signal: controller.signal,
          });

          if (isUnmountedRef.current || controller.signal.aborted) {
            return;
          }

          if (!response.ok) {
            throw new Error("Upload failed");
          }

          const data = await response.json();
          const uploaded = data?.data ?? data;

          activeControllersRef.current.delete(clientId);

          if (!uploaded?.publicId) {
            throw new Error("Missing publicId");
          }

          const publicId = uploaded.publicId;
          const initialStatus = uploaded.status ?? "PROCESSING";

          if (initialStatus === "READY") {
            // Revoke blob URL immediately upon reaching READY
            revokePreviewUrl(clientId);
            updatePhoto(clientId, {
              publicId,
              status: "READY",
              url: uploaded.url ?? null,
              localPreviewUrl: "",
              progress: 1,
            });
          } else if (initialStatus === "FAILED") {
            // Revoke blob URL immediately upon reaching FAILED
            revokePreviewUrl(clientId);
            updatePhoto(clientId, {
              publicId,
              status: "FAILED",
              localPreviewUrl: "",
              progress: 0,
            });
          } else {
            // PROCESSING
            updatePhoto(clientId, {
              publicId,
              status: "PROCESSING",
              url: uploaded.url ?? null,
              progress: 1,
            });
            pollFileStatus(clientId, publicId);
          }
        } catch {
          if (isUnmountedRef.current || controller.signal.aborted) return;
          activeControllersRef.current.delete(clientId);
          revokePreviewUrl(clientId);
          updatePhoto(clientId, { status: "FAILED", localPreviewUrl: "" });
        }
      },
      [pollFileStatus, revokePreviewUrl, updatePhoto],
    );

    // Drain queue respecting CONCURRENT_UPLOADS_LIMIT = 3
    const processQueue = React.useCallback(() => {
      if (isUnmountedRef.current) return;
      while (
        activeUploadCountRef.current < CONCURRENT_UPLOADS_LIMIT &&
        uploadQueueRef.current.length > 0
      ) {
        const item = uploadQueueRef.current.shift();
        if (!item) break;

        activeUploadCountRef.current += 1;
        uploadFileTask(item.file, item.clientId).finally(() => {
          activeUploadCountRef.current = Math.max(0, activeUploadCountRef.current - 1);
          processQueue();
        });
      }
    }, [uploadFileTask]);

    const enqueueUpload = React.useCallback(
      (file: File, clientId: string) => {
        uploadQueueRef.current.push({ file, clientId });
        processQueue();
      },
      [processQueue],
    );

    // Real retry handler: creates fresh preview, re-enqueues with fresh AbortController & idempotency key
    const retryUpload = React.useCallback(
      (clientId: string) => {
        if (isUnmountedRef.current) return;
        const file = fileMapRef.current.get(clientId);
        if (!file) return;

        // Clean up previous poll and upload controllers
        cleanupPoll(clientId);
        const prevCtrl = activeControllersRef.current.get(clientId);
        if (prevCtrl) {
          prevCtrl.abort();
          activeControllersRef.current.delete(clientId);
        }

        // Revoke any previous preview and create a fresh one for the retry attempt
        revokePreviewUrl(clientId);
        const freshPreviewUrl = URL.createObjectURL(file);
        blobUrlsRef.current.set(clientId, freshPreviewUrl);

        updatePhoto(clientId, {
          status: "PENDING",
          localPreviewUrl: freshPreviewUrl,
          publicId: null,
          url: null,
          progress: 0,
        });

        enqueueUpload(file, clientId);
      },
      [cleanupPoll, enqueueUpload, revokePreviewUrl, updatePhoto],
    );

    // Remove file and cleanup all associated controllers, timers, and previews
    const removeFile = React.useCallback(
      (clientId: string) => {
        revokePreviewUrl(clientId);
        fileMapRef.current.delete(clientId);
        uploadQueueRef.current = uploadQueueRef.current.filter((item) => item.clientId !== clientId);

        const uploadCtrl = activeControllersRef.current.get(clientId);
        if (uploadCtrl) {
          uploadCtrl.abort();
          activeControllersRef.current.delete(clientId);
        }

        cleanupPoll(clientId);
      },
      [cleanupPoll, revokePreviewUrl],
    );

    // Expose handle via imperative ref and callback
    React.useImperativeHandle(
      ref,
      () => ({
        retryUpload,
        removeFile,
      }),
      [retryUpload, removeFile],
    );

    React.useEffect(() => {
      onRegisterRetry?.(retryUpload);
    }, [onRegisterRetry, retryUpload]);

    // Handle online/offline lifecycle and safe reconnect
    React.useEffect(() => {
      const handleOffline = () => {
        // Stop all active polling timers immediately when offline
        for (const timer of activePollTimersRef.current.values()) {
          clearTimeout(timer);
        }
        activePollTimersRef.current.clear();
      };

      const handleOnline = () => {
        // Resume any paused polls safely when back online
        const paused = Array.from(activePollStateRef.current.entries());
        for (const [clientId, { publicId, attempt }] of paused) {
          pollFileStatus(clientId, publicId, attempt);
        }
      };

      window.addEventListener("offline", handleOffline);
      window.addEventListener("online", handleOnline);

      return () => {
        window.removeEventListener("offline", handleOffline);
        window.removeEventListener("online", handleOnline);
      };
    }, [pollFileStatus]);

    // Unmount cleanup: abort all uploads and polls, clear timers, revoke blob URLs
    React.useEffect(() => {
      isUnmountedRef.current = false;
      const controllers = activeControllersRef.current;
      const pollControllers = activePollControllersRef.current;
      const pollTimers = activePollTimersRef.current;
      const blobUrls = blobUrlsRef.current;
      const uploadQueue = uploadQueueRef.current;
      const fileMap = fileMapRef.current;
      const activePollState = activePollStateRef.current;

      return () => {
        isUnmountedRef.current = true;

        for (const controller of controllers.values()) {
          controller.abort();
        }
        controllers.clear();

        for (const controller of pollControllers.values()) {
          controller.abort();
        }
        pollControllers.clear();

        for (const timer of pollTimers.values()) {
          clearTimeout(timer);
        }
        pollTimers.clear();

        for (const url of blobUrls.values()) {
          if (typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
            URL.revokeObjectURL(url);
          }
        }
        blobUrls.clear();

        uploadQueue.length = 0;
        fileMap.clear();
        activePollState.clear();
      };
    }, []);

    // File validation and ingestion
    const processFiles = React.useCallback(
      (fileList: FileList | File[]) => {
        setErrorMessage(null);
        const incoming = Array.from(fileList);
        if (incoming.length === 0) return;

        const currentCount = photos.length;
        if (currentCount + incoming.length > MAX_TOTAL_PHOTOS) {
          setErrorMessage(
            ar
              ? `الحد الأقصى المسموح به هو ${MAX_TOTAL_PHOTOS} صورة فقط.`
              : `Maximum ${MAX_TOTAL_PHOTOS} photos allowed in total.`,
          );
          return;
        }

        const validFiles: { file: File; clientId: string }[] = [];

        for (const file of incoming) {
          // Sanitize filename to prevent HTML/XSS exposure
          const safeName = file.name.replace(/[<>&"']/g, "");

          if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
            setErrorMessage(
              ar
                ? `صيغة الملف ${safeName} غير مدعومة. الصيغ المسموحة: JPG, PNG, WebP.`
                : `File format ${safeName} is not supported. Allowed formats: JPG, PNG, WebP.`,
            );
            return;
          }

          if (file.size > MAX_FILE_SIZE_BYTES) {
            setErrorMessage(
              ar
                ? `حجم الملف ${safeName} يتجاوز الحد الأقصى (8 ميجابايت).`
                : `File ${safeName} exceeds the maximum size limit of 8MB.`,
            );
            return;
          }

          const clientId = crypto.randomUUID();
          const localPreviewUrl = URL.createObjectURL(file);
          blobUrlsRef.current.set(clientId, localPreviewUrl);
          fileMapRef.current.set(clientId, file);

          addPhoto({
            clientId,
            localPreviewUrl,
            publicId: null,
            url: null,
            status: "PENDING",
            progress: 0,
          });

          validFiles.push({ file, clientId });
        }

        // If no cover photo is selected, designate first newly added photo
        if (!coverPhotoClientId && validFiles[0]) {
          setCoverPhoto(validFiles[0].clientId);
        }

        // Enqueue all validated files to the bounded concurrency queue
        for (const item of validFiles) {
          enqueueUpload(item.file, item.clientId);
        }
      },
      [
        photos.length,
        ar,
        addPhoto,
        coverPhotoClientId,
        setCoverPhoto,
        enqueueUpload,
      ],
    );

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      if (disabled) return;
      setIsDragOver(true);
    };

    const handleDragLeave = () => {
      setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (disabled) return;
      if (e.dataTransfer.files) {
        processFiles(e.dataTransfer.files);
      }
    };

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        processFiles(e.target.files);
        e.target.value = ""; // Reset file input so re-selecting same files triggers change
      }
    };

    return (
      <div className="space-y-3" data-testid="photo-uploader">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "relative flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed transition-all text-center cursor-pointer",
            isDragOver
              ? "border-primary bg-primary/5 scale-[0.99]"
              : "border-border hover:border-primary/50 hover:bg-muted/30 bg-muted/10",
            disabled ? "pointer-events-none opacity-50" : "",
          )}
          data-testid="photo-dropzone"
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            onChange={handleFileInputChange}
            disabled={disabled || photos.length >= MAX_TOTAL_PHOTOS}
            className="sr-only"
            data-testid="photo-file-input"
          />

          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
            <UploadCloud className="h-6 w-6" />
          </div>

          <p className="font-semibold text-base text-foreground">
            {ar ? "اسحب وأفلت الصور هنا، أو انقر للاختيار" : "Drag and drop photos here, or click to browse"}
          </p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            {ar
              ? "الحد الأدنى 3 صور والأقصى 20 صورة. الصيغ المدعومة: JPG، PNG، WebP بحد أقصى 8 ميجابايت للصورة."
              : "Minimum 3 photos, maximum 20. Supported formats: JPG, PNG, WebP up to 8MB each."}
          </p>

          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground bg-background px-3 py-1.5 rounded-full border border-border">
            <Camera className="h-3.5 w-3.5 text-primary" />
            <span>{ar ? "التقاط من الكاميرا متاح على الهواتف" : "Camera capture supported on mobile"}</span>
          </div>
        </div>

        {errorMessage ? (
          <div
            role="alert"
            className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-xs font-medium"
            data-testid="photo-uploader-error"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        ) : null}
      </div>
    );
  },
);
