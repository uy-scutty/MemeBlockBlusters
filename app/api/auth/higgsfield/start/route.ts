import { NextResponse } from "next/server";
import { getOrCreateUserId } from "@/lib/session";
import { getHiggsfieldAuthorizeUrl } from "@/lib/higgsfield-auth";

export async function GET() {
    const userId = await getOrCreateUserId();
    const url = await getHiggsfieldAuthorizeUrl(userId);
    return NextResponse.redirect(url);
}