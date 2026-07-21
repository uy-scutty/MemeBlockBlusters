/**
 * Generic OAuth 2.1 client for MCP servers, following the MCP
 * authorization spec (discovery via /.well-known metadata + optional
 * Dynamic Client Registration, RFC 7591 + PKCE).
 *
 * We do NOT hardcode Higgsfield's authorize/token URLs — we discover
 * them from the MCP server itself, which is the spec-compliant way to
 * do this and avoids baking in endpoints that could change.
 */
import { randomBytes, createHash } from "crypto";

export interface OAuthServerMetadata {
    authorization_endpoint: string;
    token_endpoint: string;
    registration_endpoint?: string;
}

export interface DynamicClient {
    client_id: string;
    client_secret?: string | null;
}

export interface TokenResponse {
    access_token: string;
    refresh_token?: string;
    expires_in?: number; // seconds
    token_type: string;
}

/** Step 1: find the protected-resource metadata for the MCP server, which
 * points us at its authorization server. Falls back to treating the MCP
 * server's own origin as the auth server if no separate metadata exists. */
export async function discoverAuthServer(mcpServerUrl: string): Promise<string> {
    const origin = new URL(mcpServerUrl).origin;
    try {
        const res = await fetch(`${origin}/.well-known/oauth-protected-resource`);
        if (res.ok) {
            const meta = await res.json();
            const servers = meta.authorization_servers as string[] | undefined;
            if (servers?.[0]) return servers[0];
        }
    } catch {
        /* fall through */
    }
    return origin;
}

/** Step 2: fetch the authorization server's metadata (RFC 8414). */
export async function discoverServerMetadata(authServerOrigin: string): Promise<OAuthServerMetadata> {
    const candidates = [
        `${authServerOrigin}/.well-known/oauth-authorization-server`,
        `${authServerOrigin}/.well-known/openid-configuration`,
    ];
    for (const url of candidates) {
        try {
            const res = await fetch(url);
            if (res.ok) return (await res.json()) as OAuthServerMetadata;
        } catch {
            /* try next */
        }
    }
    // Last-resort convention fallback.
    return {
        authorization_endpoint: `${authServerOrigin}/authorize`,
        token_endpoint: `${authServerOrigin}/token`,
        registration_endpoint: `${authServerOrigin}/register`,
    };
}

/** Step 3: register this app as an OAuth client (RFC 7591), or reuse
 * env-configured static credentials if Higgsfield issues them manually
 * instead of supporting dynamic registration. */
export async function registerClient(
    metadata: OAuthServerMetadata,
    redirectUri: string
): Promise<DynamicClient> {
    if (process.env.HIGGSFIELD_CLIENT_ID) {
        return {
            client_id: process.env.HIGGSFIELD_CLIENT_ID,
            client_secret: process.env.HIGGSFIELD_CLIENT_SECRET ?? null,
        };
    }
    if (!metadata.registration_endpoint) {
        throw new Error(
            "No HIGGSFIELD_CLIENT_ID configured and the server has no dynamic registration endpoint. " +
            "Register an OAuth app manually in your Higgsfield dashboard and set HIGGSFIELD_CLIENT_ID / HIGGSFIELD_CLIENT_SECRET."
        );
    }
    const res = await fetch(metadata.registration_endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            client_name: "MemeBlockbuster",
            redirect_uris: [redirectUri],
            grant_types: ["authorization_code", "refresh_token"],
            response_types: ["code"],
            token_endpoint_auth_method: "none",
        }),
    });
    if (!res.ok) throw new Error(`Dynamic client registration failed: ${await res.text()}`);
    const data = await res.json();
    return { client_id: data.client_id, client_secret: data.client_secret ?? null };
}

export function generatePkcePair() {
    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    return { verifier, challenge };
}

export function buildAuthorizeUrl(opts: {
    metadata: OAuthServerMetadata;
    clientId: string;
    redirectUri: string;
    state: string;
    codeChallenge: string;
    scope?: string;
}) {
    const url = new URL(opts.metadata.authorization_endpoint);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", opts.clientId);
    url.searchParams.set("redirect_uri", opts.redirectUri);
    url.searchParams.set("state", opts.state);
    url.searchParams.set("code_challenge", opts.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    if (opts.scope) url.searchParams.set("scope", opts.scope);
    return url.toString();
}

export async function exchangeCodeForToken(opts: {
    metadata: OAuthServerMetadata;
    clientId: string;
    clientSecret?: string | null;
    redirectUri: string;
    code: string;
    codeVerifier: string;
}): Promise<TokenResponse> {
    const body = new URLSearchParams({
        grant_type: "authorization_code",
        code: opts.code,
        redirect_uri: opts.redirectUri,
        client_id: opts.clientId,
        code_verifier: opts.codeVerifier,
    });
    if (opts.clientSecret) body.set("client_secret", opts.clientSecret);

    const res = await fetch(opts.metadata.token_endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
    });
    if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`);
    return res.json();
}

export async function refreshAccessToken(opts: {
    metadata: OAuthServerMetadata;
    clientId: string;
    clientSecret?: string | null;
    refreshToken: string;
}): Promise<TokenResponse> {
    const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: opts.refreshToken,
        client_id: opts.clientId,
    });
    if (opts.clientSecret) body.set("client_secret", opts.clientSecret);

    const res = await fetch(opts.metadata.token_endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
    });
    if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);
    return res.json();
}