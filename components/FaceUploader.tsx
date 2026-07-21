"use client";

import { useState } from "react";

export function FaceUploader({ onChange }: { onChange: (urls: string[]) => void }) {
  const [previews, setPreviews] = useState<string[]>([]);

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const list = Array.from(files).slice(0, 3 - previews.length);
    // NOTE: replace with real upload to Supabase Storage / S3, returning
    // public URLs. Using local object URLs here for MVP wiring only.
    const urls = list.map((f) => URL.createObjectURL(f));
    const next = [...previews, ...urls].slice(0, 3);
    setPreviews(next);
    onChange(next);
  }

  return (
    <div>
      <p className="mb-2 text-sm text-film-paper/70">
        Upload 1–3 faces for consistent Soul ID characters across every scene.
      </p>
      <div className="flex gap-3">
        {previews.map((src, i) => (
          <img
            key={i}
            src={src}
            alt={`face-${i}`}
            className="h-20 w-20 rounded-lg border border-theatre-700 object-cover"
          />
        ))}
        {previews.length < 3 && (
          <label
            className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-lg
                       border-2 border-dashed border-theatre-700 text-2xl text-theatre-700
                       hover:border-marquee hover:text-marquee"
          >
            +
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </label>
        )}
      </div>
    </div>
  );
}
