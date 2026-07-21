"use client";

export function GenerationCounter({ count, target = 30 }: { count: number; target?: number }) {
  const pct = Math.min(100, Math.round((count / target) * 100));
  return (
    <div className="flex items-center gap-3 rounded-full border border-theatre-700 bg-theatre-900/80 px-4 py-2">
      <div className="flex h-2 w-28 overflow-hidden rounded-full bg-theatre-800">
        <div
          className="h-full bg-gradient-to-r from-marquee to-meme transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-counter text-sm text-marquee">
        {count} AI generations rolling 🎬
      </span>
    </div>
  );
}
