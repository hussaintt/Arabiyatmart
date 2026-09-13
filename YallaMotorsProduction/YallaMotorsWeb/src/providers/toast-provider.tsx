'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Toast, ToastClose, ToastDescription, ToastProvider as RadixToastProvider, ToastTitle, ToastViewport } from '@/components/ui/toast';

type ToastTone = 'default' | 'destructive' | 'success' | 'warning';
interface ToastMessage { id: string; title: string; description?: string; tone: ToastTone }
interface ToastContextValue { notify: (message: Omit<ToastMessage, 'id'>) => void }
const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);
  const notify = useCallback((message: Omit<ToastMessage, 'id'>) => {
    setMessages((current) => [...current, { ...message, id: crypto.randomUUID() }].slice(-3));
  }, []);
  const value = useMemo(() => ({ notify }), [notify]);
  return (
    <ToastContext.Provider value={value}>
      <RadixToastProvider swipeDirection="right">
        {children}
        {messages.map((message) => (
          <Toast key={message.id} open onOpenChange={(open) => !open && setMessages((items) => items.filter((item) => item.id !== message.id))} variant={message.tone}>
            <div className="min-w-0"><ToastTitle>{message.title}</ToastTitle>{message.description ? <ToastDescription>{message.description}</ToastDescription> : null}</div>
            <ToastClose />
          </Toast>
        ))}
        <ToastViewport />
      </RadixToastProvider>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used inside ToastProvider');
  return value;
}

