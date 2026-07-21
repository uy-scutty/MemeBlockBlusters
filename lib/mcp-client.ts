/**
 * Minimal MCP client over the Streamable HTTP transport (JSON-RPC 2.0).
 * Talks directly to an MCP server (Higgsfield) using a bearer token
 * obtained via lib/mcp-oauth.ts — no LLM in the loop for tool execution,
 * so cost scales with Higgsfield credits only, not tokens.
 */

export interface McpTool {
    name: string;
    description?: string;
    inputSchema: any;
}

let requestId = 0;

export class McpClient {
    private sessionId: string | null = null;
    private toolsCache: McpTool[] | null = null;

    constructor(private serverUrl: string, private accessToken: string) { }

    private async rpc(method: string, params?: any): Promise<any> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            Accept: "application/json, text/event-stream",
            Authorization: `Bearer ${this.accessToken}`,
        };
        if (this.sessionId) headers["Mcp-Session-Id"] = this.sessionId;

        const body = JSON.stringify({ jsonrpc: "2.0", id: ++requestId, method, params });

        let res: Response;
        let lastErr: unknown;
        const MAX_ATTEMPTS = 3;
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                res = await fetch(this.serverUrl, { method: "POST", headers, body });
                lastErr = undefined;
                break;
            } catch (err) {
                lastErr = err;
                if (attempt === MAX_ATTEMPTS) throw err;
                const backoffMs = 500 * attempt;
                console.warn(
                    `[mcp-client] ${method} network error (attempt ${attempt}/${MAX_ATTEMPTS}), retrying in ${backoffMs}ms:`,
                    (err as Error)?.message ?? err
                );
                await new Promise((r) => setTimeout(r, backoffMs));
            }
        }
        if (lastErr) throw lastErr; // unreachable, satisfies TS

        const newSession = res!.headers.get("Mcp-Session-Id");
        if (newSession) this.sessionId = newSession;

        if (!res!.ok) {
            throw new Error(`MCP ${method} failed (${res!.status}): ${await res!.text()}`);
        }

        const contentType = res!.headers.get("content-type") ?? "";
        let payload: any;
        if (contentType.includes("text/event-stream")) {
            payload = await parseSseJsonRpc(res!);
        } else {
            payload = await res!.json();
        }

        if (payload.error) throw new Error(`MCP ${method} error: ${JSON.stringify(payload.error)}`);
        return payload.result;
    }

    async initialize() {
        await this.rpc("initialize", {
            protocolVersion: "2025-06-18",
            capabilities: {},
            clientInfo: { name: "MemeBlockbuster", version: "1.0.0" },
        });
    }

    async listTools(): Promise<McpTool[]> {
        if (this.toolsCache) return this.toolsCache;
        const result = await this.rpc("tools/list");
        this.toolsCache = result.tools ?? [];
        return this.toolsCache!;
    }

    /** Find the best-matching tool for a task by keyword, since exact
     * Higgsfield tool names/versions can change over time. */
    async resolveTool(keywords: string[]): Promise<McpTool> {
        const tools = await this.listTools();
        const lowerKeywords = keywords.map((k) => k.toLowerCase());
        const scored = tools
            .map((t) => {
                const haystack = `${t.name} ${t.description ?? ""}`.toLowerCase();
                const score = lowerKeywords.reduce((s, k) => (haystack.includes(k) ? s + 1 : s), 0);
                return { tool: t, score };
            })
            .filter((s) => s.score > 0)
            .sort((a, b) => b.score - a.score);

        if (!scored.length) {
            throw new Error(`No Higgsfield tool matched keywords: ${keywords.join(", ")}`);
        }
        return scored[0].tool;
    }

    async callTool(name: string, args: Record<string, any>): Promise<any> {
        const result = await this.rpc("tools/call", { name, arguments: args });
        const textBlock = (result.content ?? []).find((b: any) => b.type === "text");
        return { raw: result, text: textBlock?.text ?? "", content: result.content };
    }
}

async function parseSseJsonRpc(res: Response): Promise<any> {
    const text = await res.text();
    const dataLines = text
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim());
    for (const line of dataLines) {
        try {
            return JSON.parse(line);
        } catch {
            continue;
        }
    }
    throw new Error("Could not parse SSE MCP response");
}