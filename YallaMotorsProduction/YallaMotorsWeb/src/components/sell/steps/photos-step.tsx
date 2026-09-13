"use client";

import * as React from "react";
import { CheckCircle2, Image as ImageIcon, Info } from "lucide-react";
import { useSellStore } from "@/components/sell/sell-workflow";
import { PhotoUploader, type PhotoUploaderHandle } from "@/components/sell/photo-uploader";
import { PhotoTile } from "@/components/sell/photo-tile";
import { deleteFile } from "@/server/actions/files";
import type { AppLocale } from "@/i18n/config";

interface PhotosStepProps {
  locale: AppLocale;
}

export function PhotosStep({ locale }: PhotosStepProps) {
  const photos = useSellStore((state) => state.photos);
  const coverPhotoClientId = useSellStore((state) => state.coverPhotoClientId);
  const removePhoto = useSellStore((state) => state.removePhoto);
  const setCoverPhoto = useSellStore((state) => state.setCoverPhoto);
  const reorderPhotos = useSellStore((state) => state.reorderPhotos);
  const isTransitionPending = useSellStore((state) => state.isTransitionPending);

  const uploaderRef = React.useRef<PhotoUploaderHandle | null>(null);

  const ar = locale === "ar";

  const readyPhotos = photos.filter(
    (photo) => photo.status === "READY" && photo.publicId !== null,
  );
  const isMinRequirementMet = readyPhotos.length >= 3;

  const handleRemove = (clientId: string) => {
    const target = photos.find((p) => p.clientId === clientId);
    uploaderRef.current?.removeFile(clientId);
    removePhoto(clientId);

    if (target?.publicId) {
      Promise.resolve(deleteFile({ publicId: target.publicId })).catch(() => {
        // Reconciled without disrupting client state
      });
    }
  };

  const handleRetry = (clientId: string) => {
    uploaderRef.current?.retryUpload(clientId);
  };

  const handleMove = (fromIndex: number, toIndex: number) => {
    reorderPhotos(fromIndex, toIndex);
  };

  const handleSetCover = (clientId: string) => {
    setCoverPhoto(clientId);
  };

  return (
    <div className="space-y-6" data-testid="sell-photos-step">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          {ar ? "صور السيارة" : "Vehicle Photos"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {ar
            ? "أضف صوراً واضحة وعالية الجودة للسيارة من زوايا مختلفة (الحد الأدنى 3 صور)."
            : "Add clear, high-resolution photos of the car from multiple angles (minimum 3 photos)."}
        </p>
      </div>

      {/* Uploader Dropzone */}
      <PhotoUploader
        ref={uploaderRef}
        locale={locale}
        disabled={isTransitionPending}
      />

      {/* Status & Counter bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-border bg-muted/20">
        <div className="flex items-center gap-2 text-sm">
          <ImageIcon className="h-4 w-4 text-primary" />
          <span className="font-medium text-foreground">
            {ar ? `الصور المضافة: ${photos.length} من 20` : `Uploaded Photos: ${photos.length} of 20`}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          {isMinRequirementMet ? (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
              <CheckCircle2 className="h-4 w-4" />
              {ar
                ? `مكتمل (${readyPhotos.length} جاهزة)`
                : `Complete (${readyPhotos.length} ready)`}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Info className="h-3.5 w-3.5 text-primary" />
              {ar
                ? `مطلوب ${Math.max(0, 3 - readyPhotos.length)} صور إضافية على الأقل`
                : `Need at least ${Math.max(0, 3 - readyPhotos.length)} more ready photos`}
            </span>
          )}
        </div>
      </div>

      {/* Photos Grid */}
      {photos.length > 0 ? (
        <div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
          data-testid="photo-grid"
        >
          {photos.map((photo, index) => (
            <PhotoTile
              key={photo.clientId}
              photo={photo}
              index={index}
              totalCount={photos.length}
              isCover={
                coverPhotoClientId
                  ? photo.clientId === coverPhotoClientId
                  : index === 0
              }
              onSetCover={handleSetCover}
              onRemove={handleRemove}
              onMove={handleMove}
              onRetry={handleRetry}
              locale={locale}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
