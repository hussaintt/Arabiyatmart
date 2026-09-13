import * as React from 'react';
import { Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { isOvernightHours, WeeklyBusinessHoursSchema } from '@/lib/api/schemas/dealer';
import type { AppLocale } from '@/i18n/config';
import type { BusinessDayHours, DayOfWeek, WeeklyBusinessHours } from '@/types/dealer';
import type { JsonValue } from '@/types/common';

export interface CurrentTimeOverride {
  day: DayOfWeek;
  /** In "HH:mm" 24h format, e.g. "14:30" */
  time: string;
}

export interface BusinessHoursProps {
  hours?: WeeklyBusinessHours | JsonValue | null | undefined;
  locale?: AppLocale | undefined;
  currentTime?: CurrentTimeOverride | undefined;
  className?: string | undefined;
}

const DAYS_ORDER: DayOfWeek[] = [
  'saturday',
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
];

const PREV_DAY: Record<DayOfWeek, DayOfWeek> = {
  saturday: 'friday',
  sunday: 'saturday',
  monday: 'sunday',
  tuesday: 'monday',
  wednesday: 'tuesday',
  thursday: 'wednesday',
  friday: 'thursday',
};

const DAY_LABELS: Record<DayOfWeek, { ar: string; en: string }> = {
  saturday: { ar: 'السبت', en: 'Saturday' },
  sunday: { ar: 'الأحد', en: 'Sunday' },
  monday: { ar: 'الإثنين', en: 'Monday' },
  tuesday: { ar: 'الثلاثاء', en: 'Tuesday' },
  wednesday: { ar: 'الأربعاء', en: 'Wednesday' },
  thursday: { ar: 'الخميس', en: 'Thursday' },
  friday: { ar: 'الجمعة', en: 'Friday' },
};

/**
 * Checks if a given time is within open hours for a specific day.
 * Handles both normal (open <= close) and overnight (open > close) hours.
 */
export function isDayOpen(dayHours: BusinessDayHours | undefined, time: string): boolean {
  if (!dayHours || dayHours.closed) return false;
  const { open, close } = dayHours;
  if (!open || !close) return false;

  const overnight = dayHours.isOvernight ?? isOvernightHours(open, close);
  if (!overnight) {
    return time >= open && time <= close;
  }
  // Overnight shift: open in the evening or early morning of next day
  return time >= open || time <= close;
}

/**
 * Evaluates whether the business is currently open based on current time
 * and considers overnight spillover from the previous day.
 */
export function checkIsOpenNow(
  weekly: WeeklyBusinessHours,
  currentTime: CurrentTimeOverride
): boolean {
  const todayHours = weekly[currentTime.day];
  if (todayHours && isDayOpen(todayHours, currentTime.time)) {
    return true;
  }

  // Check spillover from previous day if previous day was overnight
  const prevDay = PREV_DAY[currentTime.day];
  const prevHours = weekly[prevDay];
  if (prevHours && !prevHours.closed && (prevHours.isOvernight ?? isOvernightHours(prevHours.open, prevHours.close))) {
    if (currentTime.time <= prevHours.close) {
      return true;
    }
  }

  return false;
}

export function BusinessHours({
  hours,
  locale = 'ar',
  currentTime,
  className,
}: BusinessHoursProps) {
  const isArabic = locale === 'ar';

  const parsedWeekly: WeeklyBusinessHours | null = React.useMemo(() => {
    if (!hours || typeof hours !== 'object') return null;
    const res = WeeklyBusinessHoursSchema.safeParse(hours);
    return res.success ? res.data : null;
  }, [hours]);

  if (!parsedWeekly || Object.keys(parsedWeekly).length === 0) {
    return (
      <div className={cn('text-xs text-muted-foreground italic', className)}>
        {isArabic ? 'ساعات العمل غير محددة' : 'Business hours not specified'}
      </div>
    );
  }

  // If currentTime is provided, evaluate open/closed status
  const isOpenNow = currentTime ? checkIsOpenNow(parsedWeekly, currentTime) : null;

  return (
    <div className={cn('space-y-3', className)} data-testid="business-hours">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
          <Clock className="h-4 w-4 text-primary shrink-0" />
          <span>{isArabic ? 'ساعات العمل' : 'Business Hours'}</span>
        </div>

        {isOpenNow !== null ? (
          <Badge
            variant="soft"
            className={cn(
              'text-xs font-semibold px-2 py-0.5',
              isOpenNow
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-destructive/10 text-destructive'
            )}
            data-testid="hours-status-badge"
          >
            {isOpenNow
              ? isArabic ? 'مفتوح الآن' : 'Open Now'
              : isArabic ? 'مغلق الآن' : 'Closed Now'}
          </Badge>
        ) : null}
      </div>

      <div className="rounded-xl border bg-card/60 p-3 text-xs divide-y divide-border/50">
        {DAYS_ORDER.map((day) => {
          const dayConfig = parsedWeekly[day];
          const isToday = currentTime ? currentTime.day === day : false;
          const dayLabel = isArabic ? DAY_LABELS[day].ar : DAY_LABELS[day].en;

          if (!dayConfig || dayConfig.closed) {
            return (
              <div
                key={day}
                className={cn(
                  'flex items-center justify-between py-1.5 first:pt-0 last:pb-0',
                  isToday && 'font-bold text-primary'
                )}
                data-testid={`hours-row-${day}`}
              >
                <span>{dayLabel}</span>
                <span className="text-muted-foreground">
                  {isArabic ? 'مغلق' : 'Closed'}
                </span>
              </div>
            );
          }

          const overnight = dayConfig.isOvernight ?? isOvernightHours(dayConfig.open, dayConfig.close);

          return (
            <div
              key={day}
              className={cn(
                'flex items-center justify-between py-1.5 first:pt-0 last:pb-0',
                isToday && 'font-bold text-primary'
              )}
              data-testid={`hours-row-${day}`}
            >
              <span>{dayLabel}</span>
              <span dir="ltr" className="tabular-nums">
                {dayConfig.open} - {dayConfig.close}
                {overnight ? (
                  <span className="text-[10px] text-muted-foreground ms-1">
                    {isArabic ? '(+يوم)' : '(+1d)'}
                  </span>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
