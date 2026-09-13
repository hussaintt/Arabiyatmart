import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <main className="min-h-[calc(100vh-4rem)] bg-muted/20">{children}</main>;
}

