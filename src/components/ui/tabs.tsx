import * as React from 'react';
import { cn } from '@/lib/utils';

export function TabsList({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'inline-flex h-9 items-center justify-start rounded-lg bg-neutral-100/90 dark:bg-neutral-900/90 p-1 font-sans text-xs text-neutral-600 dark:text-neutral-400 border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs backdrop-blur-xs',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({
  active,
  onClick,
  className,
  children,
  ...props
}: {
  active: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium font-sans transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none',
        active
          ? 'bg-white text-neutral-900 shadow-xs border border-neutral-200/90 dark:bg-neutral-800 dark:text-neutral-100 dark:border-neutral-700/80 font-semibold'
          : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/50 dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:bg-neutral-850/50',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
