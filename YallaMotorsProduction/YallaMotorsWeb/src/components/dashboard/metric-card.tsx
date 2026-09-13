import type { LucideIcon } from 'lucide-react';

export function MetricCard({ label, value, Icon }: { label: string; value: string; Icon: LucideIcon }) {
  return <article className="rounded-xl border bg-card p-5 shadow-xs"><div className="mb-4 inline-flex rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" aria-hidden /></div><p className="text-sm font-medium text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-extrabold tabular-nums">{value}</p></article>;
}
