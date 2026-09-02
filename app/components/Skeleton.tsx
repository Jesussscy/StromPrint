// Skeleton.tsx — esqueletos de carga respetando prefers-reduced-motion.

export function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div aria-hidden="true" style={style} className={`rounded-xl bg-white/[0.05] animate-pulse ${className}`} />
  );
}

export function SkeletonText({ className = "" }: { className?: string }) {
  return <Skeleton className={`h-3 w-24 ${className}`} />;
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return <Skeleton className={`p-4 ${className}`} />;
}

export function SkeletonStat({ className = "" }: { className?: string }) {
  return (
    <div className="glass rounded-xl p-3">
      <Skeleton className="mb-2 h-2.5 w-16" />
      <Skeleton className="h-6 w-12" />
    </div>
  );
}