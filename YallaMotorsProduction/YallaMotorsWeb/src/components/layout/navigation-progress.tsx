'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { usePathname } from '@/i18n/routing';

type ProgressState = 'idle' | 'loading' | 'complete';

interface NavigationProgressContextType {
  startProgress: () => void;
  completeProgress: () => void;
}

const NavigationProgressContext = createContext<NavigationProgressContextType | null>(null);

const noopProgress: NavigationProgressContextType = { startProgress: () => {}, completeProgress: () => {} };

export function useNavigationProgress(): NavigationProgressContextType {
  const context = useContext(NavigationProgressContext);
  return context ?? noopProgress;
}

export function NavigationProgressProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ProgressState>('idle');
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pathname = usePathname();
  const previousPathname = useRef(pathname);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const completeProgress = useCallback(() => {
    if (state === 'idle') return;
    
    clearTimer();
    setState('complete');
    setProgress(100);

    timerRef.current = setTimeout(() => {
      setState('idle');
      setProgress(0);
    }, 400); // Wait for transition to finish
  }, [clearTimer, state]);

  const startProgress = useCallback(() => {
    clearTimer();
    setState('loading');
    setProgress(10); // Start slightly visible

    // Fake progress increment
    const incrementProgress = () => {
      setProgress((prev) => {
        if (prev >= 80) return prev;
        const diff = 80 - prev;
        const increment = Math.max(diff * 0.1, 1);
        return prev + increment;
      });
      timerRef.current = setTimeout(incrementProgress, 200);
    };

    timerRef.current = setTimeout(incrementProgress, 100);
  }, [clearTimer]);

  useEffect(() => {
    // When pathname changes, complete the progress if it was loading
    if (previousPathname.current !== pathname) {
      previousPathname.current = pathname;
      if (state === 'loading') {
        completeProgress();
      }
    }
  }, [pathname, state, completeProgress]);

  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  return (
    <NavigationProgressContext.Provider value={{ startProgress, completeProgress }}>
      {state !== 'idle' && (
        <div
          className="fixed top-0 left-0 z-50 h-[3px] bg-primary transition-all ease-out"
          style={{
            width: `${progress}%`,
            transitionDuration: state === 'complete' ? '200ms' : '300ms',
            opacity: state === 'complete' ? 0 : 1,
          }}
        />
      )}
      {children}
    </NavigationProgressContext.Provider>
  );
}

export function NavigationProgress() {
  // The progress bar itself is rendered inside the provider, so we don't necessarily
  // need a separate component unless requested to be separated. However, for the sake
  // of the request structure, we can just use the provider. 
  // If we wanted to keep the DOM clean here, we could split the UI part.
  return null;
}
