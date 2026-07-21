// types/index.ts

export type Vibe = "Epic" | "Funny" | "Dark" | "Romantic" | "SciFi" | "Thriller";

export type DirectorStyle =
  | "Nolan"
  | "Waititi"
  | "Fincher"
  | "Gerwig"
  | "Villeneuve"
  | "Shyamalan"
  | "Bay";

export interface Project {
  id: string;
  title: string;
  template: string;
  vibe: Vibe;
  director: DirectorStyle;
  status: "draft" | "generating" | "ready" | "failed";
  parentProjectId: string | null;
  soulIds: SoulId[];
  scenes: Scene[];
  generations: GenerationLogEntry[];
  finalVideoUrl: string | null;
}

export interface Scene {
  id: string;
  projectId: string;
  orderIdx: number;
  prompt: string;
  voiceoverLine?: string;
  keyframeUrl: string | null;
  videoUrl: string | null;
  status: "queued" | "keyframe_done" | "reframed" | "failed" | "completed";
  remixCount: number;
}

export interface SoulId {
  id: string;
  sourceImageUrl: string;
  label: string;
}

export interface GenerationLogEntry {
  id: string;
  projectId: string;
  sceneId: string | null;
  toolName: string;
  status: "success" | "error";
  createdAt: string;
}

export interface HiggsfieldConnection {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}