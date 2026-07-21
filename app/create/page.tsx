"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FaceUploader } from "@/components/FaceUploader";
import { DirectorStyle, Vibe } from "@/types";
import { TRENDING_TEMPLATES } from "@/lib/prompts";

const VIBES: Vibe[] = ["Epic", "Funny", "Dark", "Romantic", "SciFi", "Thriller"];
const DIRECTORS: DirectorStyle[] = ["Nolan", "Waititi", "Fincher", "Gerwig", "Villeneuve", "Shyamalan", "Bay"];

export default function CreatePage() {
  const router = useRouter();
  const params = useSearchParams();
  const templateId = params.get("template");
  const preset = TRENDING_TEMPLATES.find((t) => t.id === templateId);

  const [idea, setIdea] = useState(preset?.title ?? "");
  const [vibe, setVibe] = useState<Vibe>(preset?.vibe ?? "Epic");
  const [director, setDirector] = useState<DirectorStyle>(preset?.director ?? "Nolan");
  const [faceUrls, setFaceUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: idea,
        vibe,
        director,
        faceImageUrls: faceUrls,
        idea,
        template: templateId,
      }),
    });

    if (res.status === 401) {
      setLoading(false);
      window.location.href = "/api/auth/higgsfield/start";
      return;
    }

    const data = await res.json();

    if (!res.ok || !data.projectId) {
      setLoading(false);
      alert(`Couldn't start generation: ${data.error ?? data.message ?? "unknown error"}`);
      console.error("Generate failed:", res.status, data);
      return;
    }

    router.push(`/studio/${data.projectId}`);
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-5xl text-film-paper">Cast Your Trailer</h1>
      <p className="mt-2 text-film-paper/70">Three quick picks and we start shooting.</p>

      <div className="mt-10 space-y-10">
        <div>
          <label className="mb-2 block font-counter text-xs uppercase tracking-widest text-marquee">
            1. The Idea
          </label>
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder='"Doge in Oppenheimer" or "My boss as Darth Vader"'
            className="w-full rounded-lg border border-theatre-700 bg-theatre-900 p-4 text-film-paper
                       outline-none focus:border-marquee"
            rows={3}
          />
        </div>

        <div>
          <label className="mb-2 block font-counter text-xs uppercase tracking-widest text-marquee">
            2. Cast Your Faces (optional)
          </label>
          <FaceUploader onChange={setFaceUrls} />
        </div>

        <div>
          <label className="mb-2 block font-counter text-xs uppercase tracking-widest text-marquee">
            3. Vibe
          </label>
          <div className="flex flex-wrap gap-2">
            {VIBES.map((v) => (
              <button
                key={v}
                onClick={() => setVibe(v)}
                className={`rounded-full border px-4 py-2 text-sm transition-colors ${vibe === v
                  ? "border-marquee bg-marquee text-theatre-950"
                  : "border-theatre-700 text-film-paper/80 hover:border-marquee"
                  }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block font-counter text-xs uppercase tracking-widest text-marquee">
            4. Director Style
          </label>
          <div className="flex flex-wrap gap-2">
            {DIRECTORS.map((d) => (
              <button
                key={d}
                onClick={() => setDirector(d)}
                className={`rounded-full border px-4 py-2 text-sm transition-colors ${director === d
                  ? "border-meme bg-meme text-theatre-950"
                  : "border-theatre-700 text-film-paper/80 hover:border-meme"
                  }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!idea || loading}
          className="w-full rounded-full bg-gradient-to-r from-marquee to-meme py-4 font-display
                     text-2xl tracking-wide text-theatre-950 disabled:opacity-40"
        >
          {loading ? "Rolling Cameras…" : "Generate Trailer 🎬"}
        </button>
      </div>
    </main>
  );
}
