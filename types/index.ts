export type Vibe = "Epic" | "Funny" | "Dark" | "Romantic" | "SciFi" | "Thriller";

export type DirectorStyle =
  | "Nolan"
  | "Waititi"
  | "Fincher"
  | "Gerwig"
  | "Villeneuve"
  | "Shyamalan"
  | "Bay";
export interface Template {
  id: string;
  title: string; // "Doge in Oppenheimer"
  thumbnail: string;
  vibe: Vibe;
  director: DirectorStyle;
  promptSeed: string;
  trending: boolean;
}

export interface SoulId {
  id: string;
  projectId: string;
  label: string;
  sourceImageUrl: string;
  higgsfieldCharacterId: string | null;
  status: "pending" | "ready" | "failed";
}

export interface Scene {
  id: string;
  projectId: string;
  orderIdx: number; // 0-7
  prompt: string;
  keyframeUrl: string | null;
  videoUrl: string | null;
  status: "queued" | "keyframe_done" | "video_done" | "reframed" | "failed";
  remixCount: number;
}

export interface GenerationLogEntry {
  id: string;
  projectId: string;
  sceneId: string | null;
  toolName: string;
  status: "pending" | "success" | "error";
  createdAt: string;
}

export interface HiggsfieldConnection {
  userId: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null; // epoch ms
  tokenEndpoint: string;
  clientId: string;
  clientSecret: string | null;
}

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
  userId?: string;
}