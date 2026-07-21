import {
    discoverAuthServer,
    discoverServerMetadata,
    registerClient,
    generatePkcePair,
    buildAuthorizeUrl,
    exchangeCodeForToken,
    refreshAccessToken,
    OAuthServerMetadata,
} from "./mcp-oauth";
import { getConnection, saveConnection, savePendingAuth, takePendingAuth } from "./db";
import { randomUUID } from "crypto";

export const HIGGSFIELD_MCP_URL = "https://mcp.higgsfield.ai/mcp";

function redirectUri() {
    const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
    return `${base}/api/auth/higgsfield/callback`;
}

let cachedMetadata: OAuthServerMetadata | null = null;
async function getMetadata(): Promise<OAuthServerMetadata> {
    if (cachedMetadata) return cachedMetadata;
    const authServer = await discoverAuthServer(HIGGSFIELD_MCP_URL);
    cachedMetadata = await discoverServerMetadata(authServer);
    return cachedMetadata;
}

/** Kick off the connect flow: returns the URL to redirect the user to. */
export async function getHiggsfieldAuthorizeUrl(userId: string): Promise<string> {
    const metadata = await getMetadata();
    const client = await registerClient(metadata, redirectUri());
    const { verifier, challenge } = generatePkcePair();
    const state = randomUUID();

    await savePendingAuth(state, {
        userId,
        codeVerifier: verifier,
        clientId: client.client_id,
        clientSecret: client.client_secret ?? null,
    });

    return buildAuthorizeUrl({
        metadata,
        clientId: client.client_id,
        redirectUri: redirectUri(),
        state,
        codeChallenge: challenge,
    });
}

/** Handle the OAuth callback: exchanges the code and persists tokens. */
export async function handleHiggsfieldCallback(code: string, state: string) {
    const pending = await takePendingAuth(state);
    if (!pending) throw new Error("Invalid or expired OAuth state");

    const metadata = await getMetadata();
    const tokens = await exchangeCodeForToken({
        metadata,
        clientId: pending.clientId,
        clientSecret: pending.clientSecret,
        redirectUri: redirectUri(),
        code,
        codeVerifier: pending.codeVerifier,
    });

    await saveConnection(pending.userId, {
        userId: pending.userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiresAt: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null,
        tokenEndpoint: metadata.token_endpoint,
        clientId: pending.clientId,
        clientSecret: pending.clientSecret,
    });

    return pending.userId;
}

/** Returns a currently-valid access token for the user, refreshing if needed.
 * Returns null if the user hasn't connected Higgsfield yet. */
export async function getValidHiggsfieldToken(userId: string): Promise<string | null> {
    const conn = await getConnection(userId);
    if (!conn) return null;

    const isExpiring = conn.expiresAt !== null && conn.expiresAt < Date.now() + 60_000;
    if (!isExpiring) return conn.accessToken;

    if (!conn.refreshToken) return conn.accessToken; // best effort, may 401 downstream

    const metadata = await getMetadata();
    const refreshed = await refreshAccessToken({
        metadata,
        clientId: conn.clientId,
        clientSecret: conn.clientSecret,
        refreshToken: conn.refreshToken,
    });

    await saveConnection(userId, {
        ...conn,
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token ?? conn.refreshToken,
        expiresAt: refreshed.expires_in ? Date.now() + refreshed.expires_in * 1000 : null,
    });

    return refreshed.access_token;
}

export async function isHiggsfieldConnected(userId: string): Promise<boolean> {
    return (await getConnection(userId)) !== null;
}