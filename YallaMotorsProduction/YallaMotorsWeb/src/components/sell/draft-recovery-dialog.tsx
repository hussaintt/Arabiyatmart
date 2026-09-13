"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { AppLocale } from "@/i18n/config";

interface DraftRecoveryDialogProps {
  open: boolean;
  locale: AppLocale;
  onRestore: () => void;
  onDiscard: () => void;
}

export function DraftRecoveryDialog({
  open,
  locale,
  onRestore,
  onDiscard,
}: DraftRecoveryDialogProps) {
  const ar = locale === "ar";
  return (
    <AlertDialog open={open}>
      <AlertDialogContent data-testid="draft-recovery-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {ar ? "استعادة المسودة؟" : "Restore your draft?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {ar
              ? "وجدنا مسودة محفوظة لهذا الحساب على هذا الجهاز."
              : "We found a saved draft for this account on this device."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={onDiscard}
            data-testid="discard-sell-draft"
          >
            {ar ? "تجاهل" : "Discard"}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onRestore}
            data-testid="restore-sell-draft"
          >
            {ar ? "استعادة" : "Restore"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
