"use client";

import { DirectorStyle, Vibe } from "@/types";

export function TemplateCard({
  title,
  vibe,
  director,
  onSelect,
}: {
  title: string;
  vibe: Vibe;
  director: DirectorStyle;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="ticket-notch group relative flex w-64 shrink-0 flex-col justify-between rounded-lg
                 border border-theatre-700 bg-theatre-900 p-5 text-left transition-all
                 hover:-translate-y-1 hover:border-marquee hover:shadow-[0_0_24px_rgba(242,193,78,0.25)]"
    >
      <div className="mb-6 flex items-center justify-between text-xs uppercase tracking-widest text-theatre-700 group-hover:text-marquee-dim">
        <span>{director}</span>
        <span>{vibe}</span>
      </div>
      <h3 className="font-display text-3xl leading-none text-film-paper group-hover:text-marquee">
        {title}
      </h3>
      <div className="mt-6 text-xs font-medium text-meme opacity-0 transition-opacity group-hover:opacity-100">
        Make this trailer →
      </div>
    </button>
  );
}
