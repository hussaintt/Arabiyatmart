"use client";

import * as React from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  RotateCcw,
  Star,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { AppLocale } from "@/i18n/config";
import type { SellPhoto } from "@/types/sell";

export interface PhotoTileProps {
  photo: SellPhoto;
  index: number;
  totalCount: number;
  isCover: boolean;
  onSetCover: (clientId: string) => void;
  onRemove: (clientId: string) => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  onRetry?: (clientId: string) => void;
  locale?: AppLocale;
}

export function PhotoTile({
  photo,
  index,
  totalCount,
  isCover,
  onSetCover,
  onRemove,
  onMove,
  onRetry,
  locale = "ar",
}: PhotoTileProps) {
  const ar = locale === "ar";
  const displayUrl = photo.localPreviewUrl || photo.url;

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-all",
        isCover ? "border-primary ring-2 ring-primary/20 shadow-sm" : "border-border hover:border-border/80",
      )}
      data-testid={`photo-tile-${photo.clientId}`}
    >
      {/* Image Container */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        {displayUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displayUrl}
            alt={ar ? `صورة السيارة ${index + 1}` : `Vehicle photo ${index + 1}`}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ImageIcon className="h-8 w-8 opacity-40" />
          </div>
        )}

        {/* Top Badges */}
        <div className="absolute top-2 start-2 flex flex-wrap gap-1 z-10">
          {isCover ? (
            <Badge className="bg-primary text-primary-foreground text-xs flex items-center gap-1 shadow-sm">
              <Star className="h-3 w-3 fill-current" />
              {ar ? "صورة الغلاف" : "Cover Photo"}
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-black/60 text-white backdrop-blur-sm text-xs">
              {index + 1}
            </Badge>
          )}
        </div>

        {/* Status Overlay */}
        {photo.status === "UPLOADING" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs p-4 text-white z-10">
            <Loader2 className="h-6 w-6 animate-spin mb-2" />
            <span className="text-xs font-medium mb-1">
              {ar ? "جارِ الرفع..." : "Uploading..."} {Math.round(photo.progress * 100)}%
            </span>
            <Progress value={Math.round(photo.progress * 100)} max={100} className="w-full h-1.5" />
          </div>
        ) : photo.status === "PROCESSING" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs p-4 text-white z-10">
            <Loader2 className="h-6 w-6 animate-spin mb-2 text-primary" />
            <span className="text-xs font-medium">
              {ar ? "جارِ معالجة وتحسين الصورة..." : "Processing image..."}
            </span>
          </div>
        ) : photo.status === "FAILED" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/80 backdrop-blur-xs p-3 text-white text-center z-10">
            <span className="text-xs font-semibold text-red-200 mb-2">
              {ar ? "فشل رفع الصورة" : "Upload Failed"}
            </span>
            {onRetry ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onRetry(photo.clientId)}
                className="h-7 text-xs px-2.5 bg-white text-black hover:bg-white/90"
                aria-label={ar ? "إعادة محاولة رفع الصورة" : "Retry photo upload"}
                data-testid={`photo-retry-${photo.clientId}`}
              >
                <RotateCcw className="h-3 w-3 me-1" />
                {ar ? "إعادة المحاولة" : "Retry"}
              </Button>
            ) : null}
          </div>
        ) : photo.status === "READY" ? (
          <div className="absolute bottom-2 end-2 z-10">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </span>
          </div>
        ) : null}
      </div>

      {/* Footer Controls */}
      <div className="flex items-center justify-between p-2 gap-1 bg-card border-t border-border">
        {/* Reordering Controls */}
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={index === 0}
            onClick={() => onMove(index, index - 1)}
            aria-label={ar ? "تحريك للخلف" : "Move earlier"}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            data-testid={`photo-move-earlier-${photo.clientId}`}
          >
            {ar ? <ArrowRight className="h-3.5 w-3.5" /> : <ArrowLeft className="h-3.5 w-3.5" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={index === totalCount - 1}
            onClick={() => onMove(index, index + 1)}
            aria-label={ar ? "تحريك للأمام" : "Move later"}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            data-testid={`photo-move-later-${photo.clientId}`}
          >
            {ar ? <ArrowLeft className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
          </Button>
        </div>

        {/* Action Controls: Set Cover & Delete */}
        <div className="flex items-center gap-1">
          {!isCover && photo.status === "READY" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onSetCover(photo.clientId)}
              aria-label={ar ? "تعيين كصورة غلاف" : "Set as cover photo"}
              className="h-7 px-2 text-xs font-normal"
              data-testid={`photo-set-cover-${photo.clientId}`}
            >
              <Star className="h-3 w-3 me-1 text-amber-500" />
              {ar ? "غلاف" : "Cover"}
            </Button>
          ) : null}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onRemove(photo.clientId)}
            aria-label={ar ? "حذف الصورة" : "Remove photo"}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            data-testid={`photo-remove-${photo.clientId}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
