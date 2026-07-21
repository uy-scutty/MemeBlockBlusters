/**
 * Higgsfield MCP tool wrappers, built against the REAL tool schemas
 * (confirmed live via tool_search against the actual Higgsfield MCP
 * connector). Key facts:
 *
 *  - Every generation tool wraps args in a top-level `params` key.
 *  - Every generation tool needs a `model` id, not just a prompt.
 *  - GENERATION IS ASYNC: calling generate_image/video/audio only
 *    SUBMITS a job (response text says "Submitted 1 job..."). We must
 *    poll `job_status` with sync:true before the resulting job id can
 *    be used as an input to the next step, or downstream calls fail
 *    with "Media input not found".
 *  - generate_audio requires a real voice_id from list_voices.
 *  - Some prompts match a built-in Higgsfield style preset; the server
 *    replies with a Notice instead of submitting, and expects either
 *    model:"higgsfield_preset" (accept it) or declined_preset_id
 *    (generate literally). We always decline, to stay faithful to the
 *    generated script.
 */
import { McpClient } from "./mcp-client";
import { HIGGSFIELD_MCP_URL } from "./higgsfield-auth";

// Mock mode for testing without credits
const MOCK_MODE = process.env.NEXT_PUBLIC_MOCK_HIGGSFIELD === 'true';

export interface GenResult {
  url: string | null;
  jobId: string | null;
  raw: any;
  toolUsed: string;
}

const clientCache = new Map<string, McpClient>();
const voiceIdCache = new Map<string, string>();

async function getClient(accessToken: string): Promise<McpClient> {
  let client = clientCache.get(accessToken);
  if (!client) {
    client = new McpClient(HIGGSFIELD_MCP_URL, accessToken);
    await client.initialize();
    clientCache.set(accessToken, client);
  }
  return client;
}

function extractUrl(text: string, content?: any[]): string | null {
  const resourceBlock = content?.find((b) => b.type === "resource" || b.uri || b.url);
  if (resourceBlock?.uri) return resourceBlock.uri;
  if (resourceBlock?.url) return resourceBlock.url;
  const match = text?.match(/https?:\/\/\S+/);
  return match ? match[0].replace(/[)\].,]+$/, "") : null;
}

const UUID_RE = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;

function extractJobId(text: string, raw: any): string | null {
  const candidates = [
    raw?.jobId,
    raw?.id,
    raw?.job_id,
    raw?.result?.jobId,
    raw?.result?.id,
    raw?.data?.jobId,
    raw?.data?.id,
    raw?.job?.jobId,
    raw?.job?.id,
  ];
  const found = candidates.find((v) => typeof v === "string" && UUID_RE.test(v));
  if (found) return found;
  const match = text?.match(UUID_RE);
  return match ? match[0] : null;
}

/** Poll a submitted job until it's done - FIXED to use proper params wrapper */
async function pollJobStatus(accessToken: string, jobId: string): Promise<{ text: string; content: any[] } | null> {
  const client = await getClient(accessToken);

  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      // CRITICAL FIX: Use { params: { jobId: ... } } not { id: ... }
      const result = await client.callTool("job_status", {
        params: {
          jobId: jobId,
          sync: true
        }
      });

      console.log(`[higgsfield] job_status(${jobId}) attempt ${attempt + 1} → ${result.text?.slice(0, 300)}`);

      const text = result.text?.toLowerCase() || "";
      const stillPending = /pending|processing|queued|in_progress|submitted/i.test(text);

      if (!stillPending) {
        return { text: result.text, content: result.content };
      }

    } catch (err) {
      console.warn(`[higgsfield] job_status call failed (attempt ${attempt + 1}):`, (err as Error)?.message ?? err);
      if (attempt < 29) {
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }
      return null;
    }

    await new Promise(r => setTimeout(r, 3000));
  }

  return null;
}

async function run(
  accessToken: string,
  toolName: string,
  args: Record<string, any>
): Promise<GenResult> {
  // MOCK MODE - skip real API calls when out of credits
  if (MOCK_MODE) {
    console.log(`[mock] ${toolName} called with:`, JSON.stringify(args, null, 2));
    const mockJobId = `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Simulate different responses based on tool
    let mockUrl = null;
    if (toolName === "generate_image") {
      mockUrl = `/mock/images/${mockJobId}.jpg`;
    } else if (toolName === "generate_video" || toolName === "reframe" || toolName === "upscale_video") {
      mockUrl = `/mock/videos/${mockJobId}.mp4`;
    } else if (toolName === "generate_audio") {
      mockUrl = `/mock/audio/${mockJobId}.mp3`;
    } else if (toolName === "explainer_video") {
      mockUrl = `/mock/final/${mockJobId}.mp4`;
    }

    return {
      url: mockUrl,
      jobId: mockJobId,
      raw: { mock: true, jobId: mockJobId },
      toolUsed: toolName,
    };
  }

  // REAL MODE - actual Higgsfield API calls
  const client = await getClient(accessToken);
  let result = await client.callTool(toolName, args);

  console.log(
    `[higgsfield] tool="${toolName}" args=${JSON.stringify(args)}\n` +
    `  → text="${result.text?.slice(0, 400)}"\n` +
    `  → content=${JSON.stringify(result.content)?.slice(0, 600)}`
  );

  const presetMatch = result.text?.match(/looks like the Higgsfield preset[\s\S]*?Preset id:\s*([0-9a-fA-F-]{36})/);
  if (presetMatch) {
    const declinedId = presetMatch[1];
    const retryArgs = {
      ...args,
      params: { ...args.params, declined_preset_id: declinedId },
    };
    console.log(`[higgsfield] declining preset ${declinedId}, retrying literally`);
    result = await client.callTool(toolName, retryArgs);
    console.log(`[higgsfield] retry → ${result.text?.slice(0, 300)}`);
  }

  let jobId = extractJobId(result.text, result.raw ?? result.content);
  let finalText = result.text;
  let finalContent = result.content;

  const wasSubmitted = /Submitted \d+ job/i.test(result.text ?? "");
  if (wasSubmitted && jobId) {
    const polled = await pollJobStatus(accessToken, jobId);
    if (polled) {
      finalText = polled.text;
      finalContent = polled.content;
    }
  }

  return {
    url: extractUrl(finalText, finalContent),
    jobId,
    raw: result.raw,
    toolUsed: toolName,
  };
}

async function getDefaultVoiceId(accessToken: string): Promise<string | null> {
  // Mock mode
  if (MOCK_MODE) {
    return "mock-voice-id";
  }

  const cached = voiceIdCache.get(accessToken);
  if (cached) return cached;
  const client = await getClient(accessToken);
  const result = await client.callTool("list_voices", { params: { size: 5 } });
  console.log(`[higgsfield] list_voices → text="${result.text}"\n  content=${JSON.stringify(result.content)}`);

  let voiceId =
    result.text?.match(/"voice_id"\s*:\s*"([^"]+)"/)?.[1] ??
    result.text?.match(/voice_id[:\s]+([a-zA-Z0-9_-]{4,})/i)?.[1] ??
    result.text?.match(UUID_RE)?.[0] ??
    null;

  if (!voiceId) {
    console.warn("[higgsfield] could not extract a voice_id from list_voices — audio calls will fail");
    return null;
  }
  voiceIdCache.set(accessToken, voiceId);
  return voiceId;
}

export async function createSoulId(accessToken: string, imageUrls: string[], label: string) {
  // Mock mode
  if (MOCK_MODE) {
    console.log(`[mock] createSoulId called with label: ${label}`);
    return { soulId: `mock-soul-${Date.now()}`, toolUsed: "show_characters", raw: { mock: true } };
  }

  const client = await getClient(accessToken);
  const result = await client.callTool("show_characters", {
    params: {
      action: "train",
      name: label,
      images: imageUrls,
    }
  });
  console.log(`[higgsfield] show_characters train → ${result.text?.slice(0, 300)}`);
  const soulId = extractJobId(result.text, result.raw);
  return { soulId, toolUsed: "show_characters", raw: result.raw };
}

export async function generateSceneKeyframe(
  accessToken: string,
  opts: { scenePrompt: string; directorStyleNotes: string; characterId?: string }
) {
  const args: Record<string, any> = {
    model: opts.characterId ? "soul_2" : "nano_banana_pro",
    prompt: `${opts.scenePrompt}. ${opts.directorStyleNotes}`.trim(),
    aspect_ratio: "16:9",
  };
  if (opts.characterId) args.soul_id = opts.characterId;
  return run(accessToken, "generate_image", { params: args });
}

export async function animateScene(
  accessToken: string,
  opts: { keyframeJobId: string; motionPrompt: string }
) {
  return run(accessToken, "generate_video", {
    params: {
      model: "seedance_2_0",
      prompt: opts.motionPrompt,
      medias: [{ role: "start_image", value: opts.keyframeJobId }],
    },
  });
}

export async function reframeToVertical(accessToken: string, videoJobId: string) {
  return run(accessToken, "reframe", {
    params: {
      medias: [{ role: "video", value: videoJobId }],
      aspect_ratio: "9:16",
    },
  });
}

export async function upscaleClip(accessToken: string, videoJobId: string) {
  return run(accessToken, "upscale_video", {
    params: {
      provider: "topaz",
      video_id: videoJobId,
      resolution: "1080p",
      aspect_ratio: "9:16",
    },
  });
}

export async function generateVoiceoverLine(accessToken: string, text: string) {
  const voiceId = await getDefaultVoiceId(accessToken);
  if (!voiceId) return { url: null, jobId: null, raw: null, toolUsed: "generate_audio" };
  return run(accessToken, "generate_audio", {
    params: { model: "seed_audio", prompt: text, voice_type: "preset", voice_id: voiceId },
  });
}

export async function generateMusicBed(accessToken: string, vibe: string, durationSeconds: number) {
  const voiceId = await getDefaultVoiceId(accessToken);
  if (!voiceId) return { url: null, jobId: null, raw: null, toolUsed: "generate_audio" };
  return run(accessToken, "generate_audio", {
    params: {
      model: "seed_audio",
      prompt: `(instrumental mood cue, no words) ${durationSeconds}-second ${vibe} trailer atmosphere`,
      voice_type: "preset",
      voice_id: voiceId,
    },
  });
}

export async function composeTrailer(
  accessToken: string,
  opts: { sceneVideoJobIds: string[]; voiceoverJobIds: string[]; titleCard: string }
) {
  // FIXED: Use "items" with video and audio properties
  return run(accessToken, "explainer_video", {
    params: {
      items: opts.sceneVideoJobIds.map((videoJobId, i) => ({
        video: videoJobId,
        audio: opts.voiceoverJobIds[i] || null,
      })),
      width: 1080,
      height: 1920,
      subtitles: { font: "anton" },
    }
  });
}