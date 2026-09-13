'use client';

import * as React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

function useRevealInView(ref: React.RefObject<HTMLDivElement | null>) {
  const [visibility, setVisibility] = React.useState<'pending' | 'hidden' | 'visible'>('pending');

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisibility('visible');
      return;
    }

    // Keep SSR content visible without JavaScript and never hide above-the-fold content.
    const bounds = node.getBoundingClientRect();
    if (bounds.top < window.innerHeight && bounds.bottom > 0) {
      setVisibility('visible');
      return;
    }
    setVisibility('hidden');
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setVisibility('visible');
        observer.disconnect();
      }
    }, { rootMargin: '-72px 0px', threshold: 0.08 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);

  return visibility !== 'hidden';
}

export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const visible = useRevealInView(ref);
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      className={cn(className)}
      initial={false}
      animate={shouldReduceMotion || visible
        ? { opacity: 1, y: 0, filter: 'blur(0px)' }
        : { opacity: 0, y: 24, filter: 'blur(8px)' }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

interface RevealGridProps {
  children: React.ReactNode;
  className?: string;
}

export function RevealGrid({ children, className }: RevealGridProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const visible = useRevealInView(ref);
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      className={cn(className)}
      initial={false}
      animate={shouldReduceMotion || visible ? 'visible' : 'hidden'}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: shouldReduceMotion ? 0 : 0.09, delayChildren: shouldReduceMotion ? 0 : 0.04 } },
      }}
    >
      {React.Children.map(children, (child) => (
        <motion.div
          variants={{
            hidden: shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 22, filter: 'blur(8px)' },
            visible: {
              opacity: 1,
              y: 0,
              filter: 'blur(0px)',
              transition: { duration: shouldReduceMotion ? 0 : 0.55, ease: [0.16, 1, 0.3, 1] },
            },
          }}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
