import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const variantStyles = {
      default: 'bg-neutral-900 text-neutral-50 hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200 shadow-xs font-semibold',
      destructive: 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100/80 dark:bg-red-950/60 dark:text-red-200 dark:border-red-800/80 dark:hover:bg-red-900/60 font-semibold',
      outline: 'border border-neutral-200/90 bg-white hover:bg-neutral-50 text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900/80 dark:hover:bg-neutral-800 dark:text-neutral-200 shadow-xs',
      secondary: 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200/70 border border-neutral-200/80 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800 dark:border-neutral-800',
      ghost: 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/80 dark:text-neutral-400 dark:hover:text-neutral-100 dark:hover:bg-neutral-800',
      link: 'text-neutral-900 dark:text-neutral-100 underline-offset-4 hover:underline'
    };

    const sizeStyles = {
      default: 'h-8 px-3 py-1.5 text-xs',
      sm: 'h-7.5 px-2.5 text-[11px]',
      lg: 'h-9 px-4 text-xs',
      icon: 'h-8 w-8'
    };

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-sans text-xs font-medium transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
