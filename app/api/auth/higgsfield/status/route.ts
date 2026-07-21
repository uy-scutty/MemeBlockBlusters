import { NextResponse } from "next/server";
import { getOrCreateUserId } from "@/lib/session";
import { isHiggsfieldConnected } from "@/lib/higgsfield-auth";

export async function GET() {
    const userId = await getOrCreateUserId();
    const connected = await isHiggsfieldConnected(userId);
    return NextResponse.json({ connected, userId });
}