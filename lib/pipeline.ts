import { DIRECTOR_STYLE_NOTES, buildScenePlannerSystemPrompt, generateFallbackScenes, SCENE_COUNT } from "./prompts";
import {
  createSoulId,
  generateSceneKeyframe,
  animateScene,
  reframeToVertical,
  upscaleClip,
  generateVoiceoverLine,
  generateMusicBed,
  composeTrailer,
} from "./higgsfield";
import { DirectorStyle, Project, Scene, Vibe } from "@/types";
import { logGeneration, updateProject, updateScene, createScenes } from "./db";

const HERO_SCENE_INDICES = [2, 5, 7];

interface PipelineInput {
  projectId: string;
  userId: string;
  accessToken: string;
  title: string;
  vibe: Vibe;
  director: DirectorStyle;
  faceImageUrls: string[];
  idea: string;
}

export async function runFullPipeline(input: PipelineInput) {
  const { projectId, accessToken, vibe, director, faceImageUrls, idea } = input;

  await updateProject(projectId, { status: "generating" });

  // 1) Soul ID — best-effort, non-blocking (real training takes ~10 min,
  // see lib/higgsfield.ts). If it doesn't resolve, scenes just generate
  // without a consistent character reference this run.
  let characterId: string | undefined;
  if (faceImageUrls.length > 0) {
    const result = await createSoulId(accessToken, faceImageUrls, `${input.title}-cast`);
    await logGeneration(projectId, null, "higgsfield:show_characters", result.soulId ? "success" : "error");
    characterId = result.soulId ?? undefined;
  }

  // 2) Scene planning via Groq (or fallback).
  const scenePlan = await planScenes(idea, vibe, director);
  const scenes = await createScenes(projectId, scenePlan);

  const sceneVideoJobIds: string[] = [];
  const voiceoverJobIds: string[] = [];

  for (const scene of scenes as (Scene & { voiceoverLine?: string })[]) {
    // keyframe
    const kf = await generateSceneKeyframe(accessToken, {
      scenePrompt: scene.prompt,
      directorStyleNotes: DIRECTOR_STYLE_NOTES[director] || "Epic cinematic style with dramatic visuals",
      characterId,
    });
    await logGeneration(projectId, scene.id, "higgsfield:generate_image", kf.jobId ? "success" : "error");
    await updateScene(scene.id, { keyframeUrl: kf.url, status: "keyframe_done" });

    if (!kf.jobId) {
      await updateScene(scene.id, { status: "failed" });
      continue;
    }

    // animate
    const anim = await animateScene(accessToken, {
      keyframeJobId: kf.jobId,
      motionPrompt: `Beat ${scene.orderIdx + 1} of 8 - ${scene.prompt}`,
    });
    await logGeneration(projectId, scene.id, "higgsfield:generate_video", anim.jobId ? "success" : "error");

    let videoJobId = anim.jobId;
    let videoUrl = anim.url;

    if (videoJobId && HERO_SCENE_INDICES.includes(scene.orderIdx)) {
      const up = await upscaleClip(accessToken, videoJobId);
      await logGeneration(projectId, scene.id, "higgsfield:upscale_video", up.jobId ? "success" : "error");
      if (up.jobId) {
        videoJobId = up.jobId;
        videoUrl = up.url ?? videoUrl;
      }
    }

    if (videoJobId) {
      const reframed = await reframeToVertical(accessToken, videoJobId);
      await logGeneration(projectId, scene.id, "higgsfield:reframe", reframed.jobId ? "success" : "error");
      if (reframed.jobId) {
        videoJobId = reframed.jobId;
        videoUrl = reframed.url ?? videoUrl;
      }
    }

    await updateScene(scene.id, { videoUrl, status: videoJobId ? "reframed" : "failed" });
    if (videoJobId) sceneVideoJobIds.push(videoJobId);

    // voiceover
    const vo = await generateVoiceoverLine(accessToken, scene.voiceoverLine ?? scene.prompt);
    await logGeneration(projectId, scene.id, "higgsfield:generate_audio", vo.jobId ? "success" : "error");
    if (vo.jobId) voiceoverJobIds.push(vo.jobId);
  }

  // 4) Music bed (best-effort — see note in higgsfield.ts about the music model gap)
  const music = await generateMusicBed(accessToken, vibe, 40);
  await logGeneration(projectId, null, "higgsfield:generate_audio", music.jobId ? "success" : "error");

  // 5) Final composite
  let finalVideoUrl: string | null = null;
  if (sceneVideoJobIds.length >= 2) {
    const final = await composeTrailer(accessToken, {
      sceneVideoJobIds,
      voiceoverJobIds,
      titleCard: input.title,
    });
    await logGeneration(projectId, null, "higgsfield:explainer_video", final.jobId ? "success" : "error");
    finalVideoUrl = final.url;
  }

  await updateProject(projectId, { status: finalVideoUrl ? "ready" : "failed", finalVideoUrl });

  return { finalVideoUrl };
}

/** Regenerate a single scene (used by the Studio "remix" button). */
export async function remixScene(
  accessToken: string,
  projectId: string,
  scene: Scene,
  directorNotes: string,
  newDirection?: string
) {
  const kf = await generateSceneKeyframe(accessToken, {
    scenePrompt: newDirection ?? scene.prompt,
    directorStyleNotes: directorNotes,
  });
  await logGeneration(projectId, scene.id, "higgsfield:generate_image", kf.jobId ? "success" : "error");

  let videoUrl = kf.url;
  let videoJobId: string | null = null;

  if (kf.jobId) {
    const anim = await animateScene(accessToken, {
      keyframeJobId: kf.jobId,
      motionPrompt: newDirection ?? scene.prompt,
    });
    await logGeneration(projectId, scene.id, "higgsfield:generate_video", anim.jobId ? "success" : "error");
    videoJobId = anim.jobId;
    videoUrl = anim.url ?? videoUrl;

    if (videoJobId) {
      const reframed = await reframeToVertical(accessToken, videoJobId);
      await logGeneration(projectId, scene.id, "higgsfield:reframe", reframed.jobId ? "success" : "error");
      videoUrl = reframed.url ?? videoUrl;
    }
  }

  await updateScene(scene.id, {
    keyframeUrl: kf.url,
    videoUrl,
    status: videoJobId ? "reframed" : "failed",
    remixCount: scene.remixCount + 1,
  });

  return { keyframeUrl: kf.url, videoUrl };
}

/** "Generate Sequel" — re-plans 8 new beats continuing the story. */
export async function generateSequel(accessToken: string, userId: string, parentProject: Project) {
  const idea = `Direct sequel to "${parentProject.title}". Escalate the stakes, callback at
least one joke/image from the original, same characters.`;
  return runFullPipeline({
    projectId: parentProject.id,
    userId,
    accessToken,
    title: `${parentProject.title} 2`,
    vibe: parentProject.vibe,
    director: parentProject.director,
    faceImageUrls: parentProject.soulIds.map((s) => s.sourceImageUrl),
    idea,
  });
}

// ---- Scene Planning with Groq ---------------------------------------------

async function planScenes(idea: string, vibe: Vibe, director: DirectorStyle) {
  const apiKey = process.env.GROQ_API_KEY;

  // If no Groq API key, use fallback immediately
  if (!apiKey) {
    console.warn("⚠️ No GROQ_API_KEY found, using fallback scenes");
    const fallback = generateFallbackScenes(idea, vibe, director);
    return fallback.scenes.slice(0, SCENE_COUNT);
  }

  try {
    const system = buildScenePlannerSystemPrompt(vibe, director);

    console.log(`[groq] Planning scenes for: "${idea}"`);

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: system
          },
          {
            role: 'user',
            content: `Idea: ${idea}\n\nReturn ONLY valid JSON with a "scenes" array. Each scene must have "visual" and "voiceover" properties.`
          }
        ],
        temperature: 0.7,
        max_tokens: 1500,
        response_format: { type: "json_object" }
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`Groq API error (${res.status}): ${errorText}`);

      console.log("⚠️ Groq failed, using fallback scenes");
      const fallback = generateFallbackScenes(idea, vibe, director);
      return fallback.scenes.slice(0, SCENE_COUNT);
    }

    const data = await res.json();
    const content = data.choices[0].message.content;

    console.log(`[groq] Response received, parsing JSON...`);

    const cleanContent = content.replace(/```json\s*|\s*```/g, '').trim();
    const parsed = JSON.parse(cleanContent);

    if (!parsed.scenes || !Array.isArray(parsed.scenes)) {
      throw new Error('Invalid response structure: missing scenes array');
    }

    const scenes = parsed.scenes.slice(0, SCENE_COUNT);
    console.log(`[groq] Successfully planned ${scenes.length} scenes`);
    return scenes;

  } catch (error) {
    console.error("⚠️ Groq planning failed, using fallback scenes:", error);
    const fallback = generateFallbackScenes(idea, vibe, director);
    return fallback.scenes.slice(0, SCENE_COUNT);
  }
}