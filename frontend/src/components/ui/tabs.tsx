import * as React from 'react';
import { cn } from '../../lib/utils';

export function TabsList({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'inline-flex h-8 items-center justify-start rounded-md bg-neutral-100 dark:bg-neutral-900/90 p-0.5 font-mono text-xs text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-800',
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
        'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded px-2.5 py-1 text-xs font-medium font-mono transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
        active
          ? 'bg-white text-neutral-900 shadow-xs border border-neutral-300/80 dark:bg-neutral-800 dark:text-neutral-100 dark:border-neutral-700/60 font-semibold'
          : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60 dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:bg-neutral-850/60',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
