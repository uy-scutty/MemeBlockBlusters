/**
 * Supabase-backed data access layer. Function signatures are unchanged
 * from the earlier in-memory version, so nothing calling these needs to
 * change — only this file's internals swapped from Maps to real queries.
 *
 * Uses the SERVICE ROLE key (server-only, never expose to the client) so
 * these calls bypass RLS — safe here because every call site is a server
 * API route, never called directly from the browser.
 */
import { createClient } from "@supabase/supabase-js";
import { GenerationLogEntry, HiggsfieldConnection, Project, Scene } from "@/types";

function db() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_KEY are not set — see .env.example");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// ---- Higgsfield OAuth storage ---------------------------------------------

export async function saveConnection(userId: string, conn: HiggsfieldConnection) {
  const { error } = await db()
    .from("higgsfield_connections")
    .upsert({
      user_id: userId,
      access_token: conn.accessToken,
      refresh_token: conn.refreshToken,
      expires_at: conn.expiresAt ? new Date(conn.expiresAt).toISOString() : null,
      token_endpoint: conn.tokenEndpoint,
      client_id: conn.clientId,
      client_secret: conn.clientSecret,
      updated_at: new Date().toISOString(),
    });
  if (error) throw error;
}

export async function getConnection(userId: string): Promise<HiggsfieldConnection | null> {
  const { data, error } = await db()
    .from("higgsfield_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    userId: data.user_id,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at ? new Date(data.expires_at).getTime() : null,
    tokenEndpoint: data.token_endpoint,
    clientId: data.client_id,
    clientSecret: data.client_secret,
  };
}

export async function savePendingAuth(
  state: string,
  data: { userId: string; codeVerifier: string; clientId: string; clientSecret: string | null }
) {
  const { error } = await db().from("pending_oauth").insert({
    state,
    user_id: data.userId,
    code_verifier: data.codeVerifier,
    client_id: data.clientId,
    client_secret: data.clientSecret,
  });
  if (error) throw error;
}

export async function takePendingAuth(state: string) {
  const client = db();
  const { data, error } = await client.from("pending_oauth").select("*").eq("state", state).maybeSingle();
  if (error) throw error;
  if (!data) return null;

  await client.from("pending_oauth").delete().eq("state", state); // one-time use

  const ageMs = Date.now() - new Date(data.created_at).getTime();
  if (ageMs > 10 * 60 * 1000) return null; // 10 min expiry

  return {
    userId: data.user_id,
    codeVerifier: data.code_verifier,
    clientId: data.client_id,
    clientSecret: data.client_secret,
  };
}

// ---- Projects / scenes / generations --------------------------------------

function rowToProject(row: any, scenes: Scene[], generations: GenerationLogEntry[]): Project {
  return {
    id: row.id,
    title: row.title,
    template: row.template ?? "",
    vibe: row.vibe,
    director: row.director_style,
    status: row.status,
    parentProjectId: row.parent_project_id,
    soulIds: [], // not persisted per-project yet — see README known gaps
    scenes,
    generations,
    finalVideoUrl: row.final_video_url,
    userId: row.user_id,
  };
}

export async function createProject(input: Partial<Project> & { userId?: string }): Promise<Project> {
  const { data, error } = await db()
    .from("projects")
    .insert({
      user_id: input.userId,
      title: input.title ?? "Untitled",
      template: input.template ?? "",
      vibe: input.vibe ?? "Epic",
      director_style: input.director ?? "Nolan",
      status: "draft",
      parent_project_id: input.parentProjectId ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToProject(data, [], []);
}

export async function getProject(id: string): Promise<Project | null> {
  const client = db();
  const { data: project, error } = await client.from("projects").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!project) return null;

  const [{ data: sceneRows }, { data: genRows }] = await Promise.all([
    client.from("scenes").select("*").eq("project_id", id).order("order_idx"),
    client.from("generations").select("*").eq("project_id", id).order("created_at"),
  ]);

  const scenes: Scene[] = (sceneRows ?? []).map((s) => ({
    id: s.id,
    projectId: s.project_id,
    orderIdx: s.order_idx,
    prompt: s.prompt,
    keyframeUrl: s.keyframe_url,
    videoUrl: s.video_url,
    status: s.status,
    remixCount: s.remix_count,
  }));

  const generations: GenerationLogEntry[] = (genRows ?? []).map((g) => ({
    id: g.id,
    projectId: g.project_id,
    sceneId: g.scene_id,
    toolName: g.tool_name,
    status: g.status,
    createdAt: g.created_at,
  }));

  return rowToProject(project, scenes, generations);
}

export async function updateProject(id: string, patch: Partial<Project>) {
  const update: Record<string, any> = {};
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.finalVideoUrl !== undefined) update.final_video_url = patch.finalVideoUrl;
  if (patch.title !== undefined) update.title = patch.title;
  if (Object.keys(update).length === 0) return;

  const { error } = await db().from("projects").update(update).eq("id", id);
  if (error) throw error;
}

export async function createScenes(
  projectId: string,
  plan: { visual: string; voiceover: string }[]
): Promise<(Scene & { voiceoverLine?: string })[]> {
  const rows = plan.map((beat, idx) => ({
    project_id: projectId,
    order_idx: idx,
    prompt: beat.visual,
    voiceover_line: beat.voiceover,
    status: "queued",
  }));

  const { data, error } = await db().from("scenes").insert(rows).select();
  if (error) throw error;

  return (data ?? []).map((s) => ({
    id: s.id,
    projectId: s.project_id,
    orderIdx: s.order_idx,
    prompt: s.prompt,
    voiceoverLine: s.voiceover_line,
    keyframeUrl: s.keyframe_url,
    videoUrl: s.video_url,
    status: s.status,
    remixCount: s.remix_count,
  }));
}

export async function updateScene(id: string, patch: Partial<Scene>) {
  const update: Record<string, any> = {};
  if (patch.keyframeUrl !== undefined) update.keyframe_url = patch.keyframeUrl;
  if (patch.videoUrl !== undefined) update.video_url = patch.videoUrl;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.remixCount !== undefined) update.remix_count = patch.remixCount;
  if (Object.keys(update).length === 0) return;

  const { error } = await db().from("scenes").update(update).eq("id", id);
  if (error) throw error;
}

export async function logGeneration(
  projectId: string,
  sceneId: string | null,
  toolName: string,
  status: "success" | "error" = "success"
) {
  const { data, error } = await db()
    .from("generations")
    .insert({ project_id: projectId, scene_id: sceneId, tool_name: toolName, status })
    .select()
    .single();
  if (error) throw error;

  const entry: GenerationLogEntry = {
    id: data.id,
    projectId: data.project_id,
    sceneId: data.scene_id,
    toolName: data.tool_name,
    status: data.status,
    createdAt: data.created_at,
  };
  return entry;
}