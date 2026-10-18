export default function PageSkeleton() {
  return (
    <div className="w-full max-w-[1200px] mx-auto p-4 md:p-6 space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-8 bg-line/60 rounded-control w-1/3" />
        <div className="h-4 bg-line/40 rounded-control w-1/4" />
      </div>

      {/* Main card skeleton */}
      <div className="h-64 bg-panel border border-line rounded-ticket p-6 space-y-4">
        <div className="h-6 bg-line/50 rounded-control w-1/2" />
        <div className="space-y-2">
          <div className="h-4 bg-line/30 rounded-control w-full" />
          <div className="h-4 bg-line/30 rounded-control w-5/6" />
          <div className="h-4 bg-line/30 rounded-control w-2/3" />
        </div>
        <div className="h-10 bg-line/40 rounded-control w-32 mt-6" />
      </div>

      {/* Grid items skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="h-36 bg-panel border border-line rounded-ticket p-4 space-y-3">
          <div className="h-5 bg-line/50 rounded-control w-2/3" />
          <div className="h-4 bg-line/30 rounded-control w-full" />
        </div>
        <div className="h-36 bg-panel border border-line rounded-ticket p-4 space-y-3">
          <div className="h-5 bg-line/50 rounded-control w-2/3" />
          <div className="h-4 bg-line/30 rounded-control w-full" />
        </div>
        <div className="h-36 bg-panel border border-line rounded-ticket p-4 space-y-3">
          <div className="h-5 bg-line/50 rounded-control w-2/3" />
          <div className="h-4 bg-line/30 rounded-control w-full" />
        </div>
      </div>
    </div>
  )
}
