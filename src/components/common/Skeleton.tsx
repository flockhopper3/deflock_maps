interface SkeletonProps {
  className?: string;
}

/**
 * Pulsing placeholder block. Shape it with className (height/width/rounding);
 * always render skeletons behind useDelayedFlag so sub-150ms loads never flash.
 */
export function Skeleton({ className = '' }: SkeletonProps) {
  return <div aria-hidden="true" className={`animate-pulse rounded bg-dark-700/60 ${className}`} />;
}
