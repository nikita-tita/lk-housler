'use client';

import React from 'react';
import { cn } from './utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'card' | 'table' | 'avatar' | 'rectangular';
  width?: string | number;
  height?: string | number;
  lines?: number;
}

/**
 * Skeleton component for loading states
 * Prevents layout shift while content is loading
 * 
 * @example
 * <Skeleton variant="text" lines={3} />
 * <Skeleton variant="card" height={200} />
 */
export function Skeleton({
  variant = 'rectangular',
  width,
  height,
  lines = 1,
  className,
  ...props
}: SkeletonProps) {
  const baseClasses = 'animate-pulse bg-gray-200 rounded';

  // Variant-specific styles
  const variantClasses = {
    text: 'h-4 w-full rounded',
    card: 'h-32 w-full rounded-lg',
    table: 'h-12 w-full rounded-md',
    avatar: 'h-12 w-12 rounded-full',
    rectangular: 'w-full rounded-md',
  };

  const skeletonClass = cn(baseClasses, variantClasses[variant], className);

  const style: React.CSSProperties = {
    ...(width && { width: typeof width === 'number' ? `${width}px` : width }),
    ...(height && { height: typeof height === 'number' ? `${height}px` : height }),
  };

  // For text variant with multiple lines
  if (variant === 'text' && lines > 1) {
    return (
      <div className="space-y-2" {...props}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(skeletonClass, i === lines - 1 && 'w-3/4')}
            style={style}
          />
        ))}
      </div>
    );
  }

  return <div className={skeletonClass} style={style} {...props} />;
}

// Compound component pattern for common layouts
Skeleton.Grid = function SkeletonGrid({
  columns = 3,
  rows = 3,
  gap = 4,
}: {
  columns?: number;
  rows?: number;
  gap?: number;
}) {
  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: `${gap * 4}px`,
      }}
    >
      {Array.from({ length: columns * rows }).map((_, i) => (
        <Skeleton key={i} variant="card" />
      ))}
    </div>
  );
};

Skeleton.List = function SkeletonList({ items = 5 }: { items?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-start gap-3">
          <Skeleton variant="avatar" />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" width="60%" />
            <Skeleton variant="text" width="80%" />
          </div>
        </div>
      ))}
    </div>
  );
};
