"use client";

import { useState } from "react";
import { Scene } from "@/types";

export function SceneCard({
  scene,
  onRemix,
}: {
  scene: Scene;
  onRemix: (sceneId: string, newDirection?: string) => void;
}) {
  const [remixing, setRemixing] = useState(false);
  const [direction, setDirection] = useState("");

  return (
    <div className="ticket-notch overflow-hidden rounded-lg border border-theatre-700 bg-theatre-900">
      <div className="relative aspect-[9/16] w-full bg-theatre-800">
        {scene.videoUrl ? (
          <video src={scene.videoUrl} className="h-full w-full object-cover" muted loop autoPlay />
        ) : scene.keyframeUrl ? (
          <img src={scene.keyframeUrl} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center font-counter text-xs text-theatre-700">
            frame {scene.orderIdx + 1} rendering…
          </div>
        )}
        <span className="absolute left-2 top-2 rounded bg-theatre-950/80 px-2 py-0.5 font-counter text-[10px] text-marquee">
          SCENE {scene.orderIdx + 1}/8
        </span>
      </div>
      <div className="p-3">
        <p className="line-clamp-2 text-xs text-film-paper/70">{scene.prompt}</p>
        {remixing ? (
          <div className="mt-2 space-y-2">
            <input
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              placeholder="New direction (optional)"
              className="w-full rounded border border-theatre-700 bg-theatre-800 p-2 text-xs outline-none focus:border-marquee"
            />
            <button
              onClick={() => {
                onRemix(scene.id, direction || undefined);
                setRemixing(false);
              }}
              className="w-full rounded bg-meme py-1.5 text-xs font-medium text-theatre-950"
            >
              Reshoot Scene
            </button>
          </div>
        ) : (
          <button
            onClick={() => setRemixing(true)}
            className="mt-2 w-full rounded border border-theatre-700 py-1.5 text-xs text-film-paper/80 hover:border-marquee hover:text-marquee"
          >
            🎲 Remix{scene.remixCount > 0 ? ` (${scene.remixCount})` : ""}
          </button>
        )}
      </div>
    </div>
  );
}
