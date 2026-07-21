import { cookies } from "next/headers";
import { randomUUID } from "crypto";

const COOKIE_NAME = "mb_uid";

/** Gets the current visitor's anon user id, creating one if needed. */
export async function getOrCreateUserId(): Promise<string> {
    const store = await cookies();
    const existing = store.get(COOKIE_NAME)?.value;
    if (existing) return existing;

    const id = randomUUID();
    store.set(COOKIE_NAME, id, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
        path: "/",
    });
    return id;
}