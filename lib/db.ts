/**
 * Minimal DB access layer. Swap the in-memory maps below for real
 * Supabase/Postgres calls — the function signatures are already shaped
 * to match the schema in schema.sql, so this is a drop-in swap:
 *
 *   import { createClient } from "@supabase/supabase-js";
 *   const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
 *
 * Kept in-memory here so the pipeline is runnable/testable without infra
 * during the hackathon's first hours.
 */
import { GenerationLogEntry, HiggsfieldConnection, Project, Scene } from "@/types";
import { randomUUID } from "crypto";

// IMPORTANT: pinned to globalThis, not plain module-level `const`.
// Next.js dev mode bundles each API route as a semi-independent module
// graph, so a plain `const projects = new Map()` here can end up as a
// DIFFERENT Map instance per route file even though they all import this
// same source file — causing "project not found" right after creating it.
// globalThis is truly process-global regardless of bundling, so this
// pattern (same one used for Prisma client singletons in Next.js) fixes it.
type PendingAuthEntry = {
  userId: string;
  codeVerifier: string;
  clientId: string;
  clientSecret: string | null;
  createdAt: number;
};

const g = globalThis as unknown as {
  __mb_projects?: Map<string, Project>;
  __mb_scenes?: Map<string, Scene>;
  __mb_connections?: Map<string, HiggsfieldConnection>;
  __mb_pendingAuth?: Map<string, PendingAuthEntry>;
};

const projects = g.__mb_projects ?? (g.__mb_projects = new Map<string, Project>());
const scenes = g.__mb_scenes ?? (g.__mb_scenes = new Map<string, Scene>());
const connections = g.__mb_connections ?? (g.__mb_connections = new Map<string, HiggsfieldConnection>());

const pendingAuth =
  g.__mb_pendingAuth ?? (g.__mb_pendingAuth = new Map<string, PendingAuthEntry>());
// ---- Higgsfield OAuth storage ---------------------------------------------

export async function saveConnection(userId: string, conn: HiggsfieldConnection) {
  connections.set(userId, conn);
}

export async function getConnection(userId: string): Promise<HiggsfieldConnection | null> {
  return connections.get(userId) ?? null;
}

export async function savePendingAuth(
  state: string,
  data: { userId: string; codeVerifier: string; clientId: string; clientSecret: string | null }
) {
  pendingAuth.set(state, { ...data, createdAt: Date.now() });
}

export async function takePendingAuth(state: string) {
  const entry = pendingAuth.get(state);
  pendingAuth.delete(state); // one-time use
  if (!entry) return null;
  if (Date.now() - entry.createdAt > 10 * 60 * 1000) return null; // 10 min expiry
  return entry;
}

export async function createProject(input: Partial<Project>): Promise<Project> {
  const id = randomUUID();
  const project: Project = {
    id,
    title: input.title ?? "Untitled",
    template: input.template ?? "",
    vibe: input.vibe ?? "Epic",
    director: input.director ?? "Nolan",
    status: "draft",
    parentProjectId: input.parentProjectId ?? null,
    soulIds: input.soulIds ?? [],
    scenes: [],
    generations: [],
    finalVideoUrl: null,
  };
  projects.set(id, project);
  return project;
}

export async function getProject(id: string): Promise<Project | null> {
  return projects.get(id) ?? null;
}

export async function updateProject(id: string, patch: Partial<Project>) {
  const p = projects.get(id);
  if (!p) return;
  projects.set(id, { ...p, ...patch });
}

export async function createScenes(
  projectId: string,
  plan: { visual: string; voiceover: string }[]
): Promise<(Scene & { voiceoverLine?: string })[]> {
  const created = plan.map((beat, idx) => {
    const scene: Scene & { voiceoverLine?: string } = {
      id: randomUUID(),
      projectId,
      orderIdx: idx,
      prompt: beat.visual,
      voiceoverLine: beat.voiceover,
      keyframeUrl: null,
      videoUrl: null,
      status: "queued",
      remixCount: 0,
    };
    scenes.set(scene.id, scene);
    return scene;
  });
  const project = projects.get(projectId);
  if (project) project.scenes = created;
  return created;
}

export async function updateScene(id: string, patch: Partial<Scene>) {
  const s = scenes.get(id);
  if (!s) return;
  const updated = { ...s, ...patch };
  scenes.set(id, updated);
  const project = projects.get(s.projectId);
  if (project) {
    project.scenes = project.scenes.map((sc) => (sc.id === id ? updated : sc));
  }
}

export async function logGeneration(
  projectId: string,
  sceneId: string | null,
  toolName: string,
  status: "success" | "error" = "success"
) {
  const entry: GenerationLogEntry = {
    id: randomUUID(),
    projectId,
    sceneId,
    toolName,
    status,
    createdAt: new Date().toISOString(),
  };
  const project = projects.get(projectId);
  if (project) project.generations.push(entry);
  return entry;
}