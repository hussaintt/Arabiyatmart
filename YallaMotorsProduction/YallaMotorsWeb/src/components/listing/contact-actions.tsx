'use client';

import * as React from 'react';
import { Phone, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AppLocale } from '@/i18n/config';

export interface ContactActionsProps {
  phone?: string | null | undefined;
  whatsapp?: string | null | undefined;
  className?: string | undefined;
  variant?: ('default' | 'compact' | 'icons-only') | undefined;
  locale?: AppLocale | undefined;
  onContactClick?: ((channel: 'call' | 'whatsapp') => void) | undefined;
}

/**
 * Validates and sanitizes a phone number for tel: links.
 * Strictly permits optional leading '+' followed by 7-15 decimal digits.
 */
function sanitizePhoneNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const cleaned = trimmed.replace(/[\s\-().]/g, '');
  if (/^\+?[0-9]{7,15}$/.test(cleaned)) {
    return cleaned;
  }
  return null;
}

/**
 * Validates and formats a WhatsApp HTTPS URL.
 * Strictly generates https://wa.me/<digits> with no arbitrary protocols or unencoded data.
 */
function formatWhatsAppUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 7 && digits.length <= 15) {
    return `https://wa.me/${digits}`;
  }
  return null;
}

export function ContactActions({
  phone,
  whatsapp,
  className,
  variant = 'default',
  locale = 'ar',
  onContactClick,
}: ContactActionsProps) {
  const isArabic = locale === 'ar';
  const validPhone = sanitizePhoneNumber(phone);
  const validWhatsAppUrl = formatWhatsAppUrl(whatsapp ?? phone);

  if (!validPhone && !validWhatsAppUrl) {
    return null;
  }

  const callLabel = isArabic ? 'الاتصال بالبائع' : 'Call seller';
  const whatsappLabel = isArabic ? 'مراسلة عبر واتساب' : 'Chat on WhatsApp';

  const handleCallClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    onContactClick?.('call');
  };

  const handleWhatsAppClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    onContactClick?.('whatsapp');
  };

  const isIconsOnly = variant === 'icons-only';
  const isCompact = variant === 'compact';

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {validPhone ? (
        <Button
          asChild
          variant="outline"
          size={isIconsOnly ? 'icon' : isCompact ? 'sm' : 'default'}
          className={cn(
            'flex-1 font-medium transition-colors hover:bg-primary/5 hover:text-primary hover:border-primary',
            isIconsOnly && 'flex-none'
          )}
        >
          <a
            href={`tel:${validPhone}`}
            onClick={handleCallClick}
            aria-label={callLabel}
            title={callLabel}
          >
            <Phone className="h-4 w-4 shrink-0" />
            {!isIconsOnly ? (
              <span className="truncate">{isArabic ? 'اتصال' : 'Call'}</span>
            ) : null}
          </a>
        </Button>
      ) : null}

      {validWhatsAppUrl ? (
        <Button
          asChild
          variant="default"
          size={isIconsOnly ? 'icon' : isCompact ? 'sm' : 'default'}
          className={cn(
            'flex-1 bg-emerald-600 font-medium text-white hover:bg-emerald-700 focus-visible:ring-emerald-500',
            isIconsOnly && 'flex-none'
          )}
        >
          <a
            href={validWhatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleWhatsAppClick}
            aria-label={whatsappLabel}
            title={whatsappLabel}
          >
            <MessageCircle className="h-4 w-4 shrink-0" />
            {!isIconsOnly ? (
              <span className="truncate">{isArabic ? 'واتساب' : 'WhatsApp'}</span>
            ) : null}
          </a>
        </Button>
      ) : null}
    </div>
  );
}
