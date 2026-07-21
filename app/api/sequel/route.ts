import { NextRequest, NextResponse } from "next/server";
import { createProject, getProject } from "@/lib/db";
import { generateSequel } from "@/lib/pipeline";

export async function POST(req: NextRequest) {
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
  });

  generateSequel({ ...parent, id: sequelProject.id }).catch((err) =>
    console.error("Sequel pipeline failed", err)
  );

  return NextResponse.json({ projectId: sequelProject.id, status: "generating" });
}
