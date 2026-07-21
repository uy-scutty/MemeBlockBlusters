"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Scene } from "@/types";
import { SceneCard } from "@/components/SceneCard";
import { GenerationCounter } from "@/components/GenerationCounter";

interface StatusResponse {
  status: string;
  generationCount: number;
  scenes: Scene[];
  finalVideoUrl: string | null;
  error?: string;
}

export default function StudioPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<StatusResponse | null>(null);
  const [notFoundStreak, setNotFoundStreak] = useState(0);

  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const res = await fetch(`/api/generate?projectId=${id}`);
        const json = await res.json();

        if (!active) return;

        if (json.error) {
          setNotFoundStreak((n) => n + 1);
          setData({
            status: "error",
            generationCount: 0,
            scenes: [],
            finalVideoUrl: null,
            error: json.error,
          });
          if (notFoundStreak < 10) {
            setTimeout(poll, 2000);
          }
          return;
        }

        setData(json);

        if (json.status === "generating") {
          setTimeout(poll, 3000);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }

    poll();

    return () => {
      active = false;
    };
  }, [id, notFoundStreak]);

  async function handleRemix(sceneId: string, newDirection?: string) {
    await fetch("/api/remix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: id, sceneId, newDirection }),
    });
    const res = await fetch(`/api/generate?projectId=${id}`);
    setData(await res.json());
  }

  async function handleSequel() {
    const res = await fetch("/api/sequel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: id }),
    });
    const json = await res.json();
    router.push(`/studio/${json.projectId}`);
  }

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="font-display text-3xl text-marquee">Loading the projection room…</p>
      </main>
    );
  }

  if (data.error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-display text-3xl text-marquee">Lost the reel — project not found</p>
        <p className="max-w-md text-sm text-film-paper/70">
          This usually means the dev server restarted after this project was created (project data
          is stored in memory right now, not a real database — see README). Try generating a new
          trailer.
        </p>
        <button
          onClick={() => router.push("/create")}
          className="rounded-full bg-marquee px-6 py-3 font-display text-lg text-theatre-950"
        >
          Start a new trailer
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-4xl text-film-paper">The Cutting Room</h1>
        <GenerationCounter count={data.generationCount} />
      </div>

      <div className="sprocket-rail mb-6 h-3 w-full opacity-30" />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {(data.scenes ?? []).map((scene) => (
          <SceneCard key={scene.id} scene={scene} onRemix={handleRemix} />
        ))}
      </div>

      <div className="sprocket-rail mt-6 h-3 w-full opacity-30" />

      {data.status === "ready" && data.finalVideoUrl && (
        <div className="mt-10 flex flex-col items-center gap-4">
          <video
            src={data.finalVideoUrl}
            controls
            className="aspect-[9/16] w-full max-w-sm rounded-xl"
          />
          <div className="flex gap-3">
            <a
              href={data.finalVideoUrl}
              download
              className="rounded-full bg-marquee px-6 py-3 font-display text-lg text-theatre-950"
            >
              Download & Share #MemeBlockbuster
            </a>
            <button
              onClick={handleSequel}
              className="rounded-full border border-meme px-6 py-3 font-display text-lg text-meme hover:bg-meme hover:text-theatre-950"
            >
              🎬 Generate Sequel
            </button>
          </div>
        </div>
      )}

      {data.status === "generating" && (
        <p className="mt-8 text-center font-counter text-sm text-theatre-700">
          Shooting in progress — scenes populate live as each one wraps.
        </p>
      )}

      {data.status === "failed" && (
        <div className="mt-8 flex flex-col items-center gap-3 text-center">
          <p className="font-counter text-sm text-red-400">
            The shoot hit a wall — check your terminal for the error (common causes: missing
            GEMINI_API_KEY, or a Higgsfield tool argument mismatch — see README's "ADJUST ARGS" note).
          </p>
          <button
            onClick={() => router.push("/create")}
            className="rounded-full border border-marquee px-5 py-2 text-sm text-marquee hover:bg-marquee hover:text-theatre-950"
          >
            Try again
          </button>
        </div>
      )}
    </main>
  );
}