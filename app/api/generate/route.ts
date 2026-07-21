import { NextRequest, NextResponse } from "next/server";
import { createProject, getProject, updateProject } from "@/lib/db";
import { runFullPipeline } from "@/lib/pipeline";
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

  const body = await req.json();
  const { title, vibe, director, faceImageUrls, idea } = body;

  if (!title || !vibe || !director || !idea) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const project = await createProject({ title, vibe, director, template: body.template, userId });

  // Fire and forget
  runFullPipeline({
    projectId: project.id,
    userId,
    accessToken,
    title,
    vibe,
    director,
    faceImageUrls: faceImageUrls ?? [],
    idea,
  }).catch((err) => {
    console.error("Pipeline failed", err);
    updateProject(project.id, { status: "failed" });
  });

  return NextResponse.json({ projectId: project.id, status: "generating" });
}

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const project = await getProject(projectId);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({
    status: project.status,
    generationCount: project.generations.length,
    scenes: project.scenes,
    finalVideoUrl: project.finalVideoUrl,
  });
}