"use client";

import Link from "next/link";
import { TRENDING_TEMPLATES } from "@/lib/prompts";
import { TemplateCard } from "@/components/TemplateCard";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      {/* Hero — the marquee */}
      <section className="mb-20 text-center">
        <p className="mb-3 font-counter text-xs uppercase tracking-[0.3em] text-meme">
          Now Showing Everywhere
        </p>
        <h1 className="font-display text-6xl leading-[0.9] text-film-paper marquee-glow sm:text-8xl">
          Your Meme.
          <br />
          <span className="text-marquee">The Movie.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-theatre-700/90 text-film-paper/70">
          Drop in an idea, upload a few faces, pick a director. MemeBlockbuster casts,
          shoots, scores, and cuts a full cinematic trailer — built scene by scene on
          Higgsfield.
        </p>
        <Link
          href="/create"
          className="mt-8 inline-block rounded-full bg-marquee px-8 py-3 font-display text-xl
                     tracking-wide text-theatre-950 transition-transform hover:scale-105"
        >
          Start My Trailer
        </Link>
      </section>

      {/* Trending templates strip */}
      <section>
        <div className="mb-5 flex items-baseline justify-between">
          <h2 className="font-display text-2xl tracking-wide text-film-paper">
            Trending This Week
          </h2>
          <span className="font-counter text-xs text-theatre-700">#MemeBlockbuster</span>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {TRENDING_TEMPLATES.map((t) => (
            <TemplateCard
              key={t.id}
              title={t.title}
              vibe={t.vibe}
              director={t.director}
              onSelect={() => router.push(`/create?template=${t.id}`)}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
