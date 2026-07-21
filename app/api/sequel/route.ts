import { NextRequest, NextResponse } from "next/server";
import { createProject, getProject } from "@/lib/db";
import { generateSequel } from "@/lib/pipeline";
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

  const { projectId } = await req.json();
  const parent = await getProject(projectId);
  if (!parent) return NextResponse.json({ error: "not found" }, { status: 404 });

  const sequelProject = await createProject({
    title: `${parent.title} 2`,
    vibe: parent.vibe,
    director: parent.director,
    template: parent.template,
    parentProjectId: parent.id,
    soulIds: parent.soulIds,
    userId,
  });

  generateSequel(accessToken, userId, { ...parent, id: sequelProject.id }).catch((err) =>
    console.error("Sequel pipeline failed", err)
  );

  return NextResponse.json({ projectId: sequelProject.id, status: "generating" });
}