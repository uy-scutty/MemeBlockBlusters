import { NextRequest, NextResponse } from "next/server";
import { handleHiggsfieldCallback } from "@/lib/higgsfield-auth";

export async function GET(req: NextRequest) {
    const code = req.nextUrl.searchParams.get("code");
    const state = req.nextUrl.searchParams.get("state");
    const base = process.env.APP_BASE_URL ?? "http://localhost:3000";

    if (!code || !state) {
        return NextResponse.redirect(`${base}/create?higgsfield_error=missing_code`);
    }

    try {
        await handleHiggsfieldCallback(code, state);
        return NextResponse.redirect(`${base}/create?higgsfield_connected=1`);
    } catch (err: any) {
        console.error("Higgsfield OAuth callback failed:", err);
        return NextResponse.redirect(
            `${base}/create?higgsfield_error=${encodeURIComponent(err.message ?? "unknown")}`
        );
    }
}