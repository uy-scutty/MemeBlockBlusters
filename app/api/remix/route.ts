import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db";
import { remixScene } from "@/lib/pipeline";
import { DIRECTOR_STYLE_NOTES } from "@/lib/prompts";
import { getOrCreateUserId } from "@/lib/session";
import { getValidHiggsfieldToken } from "@/lib/higgsfield-auth";

export async function POST(req: NextRequest) {
  const userId = await getOrCreateUserId();
  const accessToken = await getValidHiggsfieldToken(userId);
  if (!accessToken) {
    return NextResponse.json(
      { error: "not_connected", message: "Connect your Higgsfield account first." },
      { status: 401 }
    );
  }

  const { projectId, sceneId, newDirection } = await req.json();
  const project = await getProject(projectId);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

  const scene = project.scenes.find((s) => s.id === sceneId);
  if (!scene) return NextResponse.json({ error: "scene not found" }, { status: 404 });

  const result = await remixScene(
    accessToken,
    projectId,
    scene,
    DIRECTOR_STYLE_NOTES[project.director],
    newDirection
  );

  return NextResponse.json(result);
}