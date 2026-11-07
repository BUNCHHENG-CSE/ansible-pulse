import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'warning' | 'success' | 'info';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variantStyles = {
    default: 'bg-neutral-100 text-neutral-800 border border-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:border-neutral-700/80',
    secondary: 'bg-neutral-100/70 text-neutral-700 border border-neutral-200/80 dark:bg-neutral-850 dark:text-neutral-300 dark:border-neutral-800',
    destructive: 'bg-red-50 text-red-700 border border-red-200/80 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800/60',
    warning: 'bg-amber-50 text-amber-800 border border-amber-200/80 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60',
    success: 'bg-emerald-50 text-emerald-800 border border-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60',
    info: 'bg-blue-50 text-blue-700 border border-blue-200/80 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/60',
    outline: 'text-neutral-700 border border-neutral-200/90 bg-transparent dark:text-neutral-300 dark:border-neutral-800'
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 font-mono text-[10px] font-medium px-2 py-0.5 rounded-full transition-colors',
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
}
