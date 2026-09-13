'use client';

/**
 * Client Debounce Hook with Composition Safety.
 *
 * Implements Phase 1 Section 2.6 & 4.5 and Phase 3 TASK-029:
 * - Stable initial value matching the provided value without server/client clock drift.
 * - Automatic timer cleanup on value change, delay change, or unmount.
 * - Composition-event safety: pauses debounced commits while IME / virtual keyboard composition is active.
 * - Zero clock access (Date.now / performance.now) during initial render to ensure hydration stability.
 */

import { useEffect, useRef, useState } from 'react';

export interface UseDebouncedValueOptions {
  /**
   * Set to true when an IME or virtual keyboard composition event is active.
   * While composing, updates are held in a ref and committed once composition concludes.
   */
  isComposing?: boolean | undefined;
}

/**
 * Returns a debounced version of the input value.
 *
 * @param value The value to debounce.
 * @param delayMs Delay in milliseconds (default 300ms).
 * @param options Configuration options including active composition tracking.
 */
export function useDebouncedValue<T>(
  value: T,
  delayMs: number = 300,
  options?: UseDebouncedValueOptions
): T {
  // Stable initial value without clock access during render
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const isComposing = options?.isComposing ?? false;

  // Track latest value during active composition
  const pendingValueRef = useRef<T>(value);
  pendingValueRef.current = value;

  useEffect(() => {
    // If actively composing, pause timer; update will be scheduled once composition ends
    if (isComposing) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setDebouncedValue(pendingValueRef.current);
    }, Math.max(0, delayMs));

    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs, isComposing]);

  return debouncedValue;
}

export const useDebounce = useDebouncedValue;

/**
 * Helper hook for managing IME composition event handlers for input fields.
 */
export function useCompositionState() {
  const [isComposing, setIsComposing] = useState(false);

  return {
    isComposing,
    compositionProps: {
      onCompositionStart: () => setIsComposing(true),
      onCompositionEnd: () => setIsComposing(false),
    },
  };
}
