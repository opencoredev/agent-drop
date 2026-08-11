// Stateless MCP server (Streamable HTTP).
//
// Protocol only: JSON-RPC framing, header validation, the tool catalog. Tool
// execution lives in http.ts, which holds the storage, auth, and rate-limit
// helpers, and is passed in as `run`.
//
// Revision 2026-07-28 removed protocol-level sessions, the GET/SSE stream, and
// the `initialize` handshake. Every POST carries its own protocol version,
// client info, and capabilities in `params._meta`, mirrored into HTTP headers.
// Nothing is held between calls, which is what lets this run on a serverless
// function with no sticky routing.
//
// Older clients are still common, so the server is dual-era: a request that
// omits `MCP-Protocol-Version`, or names a pre-2026 version, is answered with
// the legacy `initialize` flow instead. No session id is ever minted.
//
// Spec: https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http

export const MODERN_VERSION = "2026-07-28";
const LEGACY_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"] as const;
export const SUPPORTED_VERSIONS = [MODERN_VERSION, ...LEGACY_VERSIONS] as const;

const META_VERSION = "io.modelcontextprotocol/protocolVersion";
const META_SERVER_INFO = "io.modelcontextprotocol/serverInfo";

export const SERVER_INFO = { name: "agentdrop", version: "1.0.0" } as const;

/** JSON-RPC error codes the MCP spec reserves for the transport. */
const HEADER_MISMATCH = -32020;
const UNSUPPORTED_VERSION = -32022;
const METHOD_NOT_FOUND = -32601;

type JsonSchema = Record<string, unknown>;

export type McpTool = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
};

const CONTENT_FIELDS: JsonSchema = {
  kind: {
    type: "string",
    enum: ["markdown", "html"],
    description: "Whether `content` is Markdown or a full HTML document.",
  },
  content: {
    type: "string",
    description:
      "The whole document. One file, not a folder. Never include secrets, keys, or tokens: the page is public.",
  },
  title: { type: "string", description: "Optional title shown in the viewer chrome." },
};

export const MCP_TOOLS: McpTool[] = [
  {
    name: "deploy_site",
    description:
      "Publish a new static site (Markdown or HTML) and get back a public URL. Returns an editToken that is required to change the site later, so save it.",
    inputSchema: {
      type: "object",
      properties: CONTENT_FIELDS,
      required: ["kind", "content"],
      additionalProperties: false,
    },
  },
  {
    name: "update_site",
    description:
      "Replace the content of an existing site. The URL stays the same, viewers see the change immediately, and the old version stays in history so it can be undone.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Slug returned by deploy_site." },
        editToken: { type: "string", description: "Edit token returned by deploy_site." },
        ...CONTENT_FIELDS,
      },
      required: ["slug", "editToken", "kind", "content"],
      additionalProperties: false,
    },
  },
  {
    name: "undo_site",
    description: "Step the site back to its previous version. Use this instead of redeploying.",
    inputSchema: {
      type: "object",
      properties: { slug: { type: "string" }, editToken: { type: "string" } },
      required: ["slug", "editToken"],
      additionalProperties: false,
    },
  },
  {
    name: "redo_site",
    description: "Step the site forward again after an undo.",
    inputSchema: {
      type: "object",
      properties: { slug: { type: "string" }, editToken: { type: "string" } },
      required: ["slug", "editToken"],
      additionalProperties: false,
    },
  },
  {
    name: "get_site",
    description:
      "Read a site's status: kind, title, current version, how many versions exist, whether undo or redo is available, and when it expires.",
    inputSchema: {
      type: "object",
      properties: { slug: { type: "string" } },
      required: ["slug"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_site",
    description: "Delete a site and its history for good.",
    inputSchema: {
      type: "object",
      properties: { slug: { type: "string" }, editToken: { type: "string" } },
      required: ["slug", "editToken"],
      additionalProperties: false,
    },
  },
];

const INSTRUCTIONS = `Publish static pages for the user and hand back the URL.

Call deploy_site with one Markdown or HTML document. Save the editToken and slug it
returns: they are the only way to update, undo, or delete that page later. Prefer
update_site and undo_site over deploying a second page, because the URL stays stable
and anyone holding it sees changes right away.

Page content is public. Never put API keys, tokens, passwords, or .env values in it.

Anonymous pages are kept 30 days. The manageUrl lets the user sign in and keep one for 90.`;

const CAPABILITIES = { tools: { listChanged: false } };

export type ToolResult = { text: string; isError?: boolean };
export type ToolRunner = (name: string, args: Record<string, unknown>) => Promise<ToolResult>;

type JsonRpcId = string | number | null;

function ok(id: JsonRpcId, value: unknown) {
  return { jsonrpc: "2.0" as const, id, result: value };
}

function err(id: JsonRpcId, code: number, message: string, data?: unknown) {
  return {
    jsonrpc: "2.0" as const,
    id,
    error: data === undefined ? { code, message } : { code, message, data },
  };
}

export type McpReply = { status: number; body: unknown | null };

/** Header values the transport mirrors from the body, per revision 2026-07-28. */
export type McpHeaders = {
  protocolVersion: string | null;
  method: string | null;
  name: string | null;
};

export function readMcpHeaders(request: Request): McpHeaders {
  return {
    protocolVersion: request.headers.get("mcp-protocol-version"),
    method: request.headers.get("mcp-method"),
    name: request.headers.get("mcp-name"),
  };
}

/** `Mcp-Name` may arrive base64-wrapped when the value is not plain ASCII. */
function decodeHeaderValue(value: string): string {
  const match = value.match(/^=\?B\?(.*)\?=$/);
  if (!match) return value;
  try {
    return atob(match[1] ?? "");
  } catch {
    return value;
  }
}

function isModern(version: string | null): boolean {
  return version === MODERN_VERSION;
}

/**
 * Modern requests must agree with their mirrored headers, so an intermediary
 * routing on a header can never disagree with what the server executes.
 */
function validateHeaders(
  id: JsonRpcId,
  headers: McpHeaders,
  method: string,
  params: Record<string, unknown>,
): unknown | null {
  const meta = (params._meta ?? {}) as Record<string, unknown>;
  const bodyVersion =
    typeof meta[META_VERSION] === "string" ? (meta[META_VERSION] as string) : null;

  if (bodyVersion && bodyVersion !== headers.protocolVersion) {
    return err(
      id,
      HEADER_MISMATCH,
      `Header mismatch: MCP-Protocol-Version '${headers.protocolVersion}' does not match body value '${bodyVersion}'`,
    );
  }

  if (!headers.method) {
    return err(id, HEADER_MISMATCH, "Missing required header: Mcp-Method");
  }
  if (headers.method !== method) {
    return err(
      id,
      HEADER_MISMATCH,
      `Header mismatch: Mcp-Method header value '${headers.method}' does not match body value '${method}'`,
    );
  }

  if (method === "tools/call") {
    const bodyName = typeof params.name === "string" ? params.name : "";
    if (!headers.name) {
      return err(id, HEADER_MISMATCH, "Missing required header: Mcp-Name");
    }
    if (decodeHeaderValue(headers.name) !== bodyName) {
      return err(
        id,
        HEADER_MISMATCH,
        `Header mismatch: Mcp-Name header value '${headers.name}' does not match body value '${bodyName}'`,
      );
    }
  }

  return null;
}

async function callTool(id: JsonRpcId, params: Record<string, unknown>, run: ToolRunner) {
  const name = typeof params.name === "string" ? params.name : "";
  if (!MCP_TOOLS.some((t) => t.name === name)) {
    return { status: 200, body: err(id, -32602, `Unknown tool: ${name || "(missing name)"}`) };
  }
  const args = (params.arguments ?? {}) as Record<string, unknown>;
  const { text, isError } = await run(name, args);
  return {
    status: 200,
    body: ok(id, { content: [{ type: "text", text }], isError: isError ?? false }),
  };
}

/** One JSON-RPC message in, one HTTP reply out. A null body means 202 No Content. */
export async function handleMcpMessage(
  message: unknown,
  headers: McpHeaders,
  run: ToolRunner,
): Promise<McpReply> {
  const msg = (message ?? {}) as Record<string, unknown>;
  const id = (msg.id ?? null) as JsonRpcId;
  const method = typeof msg.method === "string" ? msg.method : "";
  const params = (msg.params ?? {}) as Record<string, unknown>;

  // Notifications carry no id and expect no reply. `notifications/initialized`
  // from a legacy client lands here.
  if (method.startsWith("notifications/")) return { status: 202, body: null };

  const version = headers.protocolVersion;
  if (version && !(SUPPORTED_VERSIONS as readonly string[]).includes(version)) {
    return {
      status: 400,
      body: err(id, UNSUPPORTED_VERSION, "Unsupported protocol version", {
        supported: SUPPORTED_VERSIONS,
        requested: version,
      }),
    };
  }

  if (isModern(version)) {
    const mismatch = validateHeaders(id, headers, method, params);
    if (mismatch) return { status: 400, body: mismatch };

    switch (method) {
      case "server/discover":
        return {
          status: 200,
          body: ok(id, {
            resultType: "complete",
            supportedVersions: SUPPORTED_VERSIONS,
            capabilities: CAPABILITIES,
            instructions: INSTRUCTIONS,
            _meta: { [META_SERVER_INFO]: SERVER_INFO },
            ttlMs: 3_600_000,
            cacheScope: "public",
          }),
        };
      case "ping":
        return { status: 200, body: ok(id, {}) };
      case "tools/list":
        return { status: 200, body: ok(id, { tools: MCP_TOOLS }) };
      case "tools/call":
        return await callTool(id, params, run);
      default:
        // Modern servers answer an unknown method with 404, so a client can tell
        // this apart from a legacy endpoint that simply is not there.
        return {
          status: 404,
          body: err(id, METHOD_NOT_FOUND, `Method not found: ${method || "(missing method)"}`),
        };
    }
  }

  // Legacy era: the `initialize` handshake, answered without minting a session.
  switch (method) {
    case "initialize": {
      const asked = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
      const protocolVersion = (LEGACY_VERSIONS as readonly string[]).includes(asked)
        ? asked
        : LEGACY_VERSIONS[0];
      return {
        status: 200,
        body: ok(id, {
          protocolVersion,
          capabilities: CAPABILITIES,
          serverInfo: SERVER_INFO,
          instructions: INSTRUCTIONS,
        }),
      };
    }
    case "ping":
      return { status: 200, body: ok(id, {}) };
    case "tools/list":
      return { status: 200, body: ok(id, { tools: MCP_TOOLS }) };
    case "tools/call":
      return await callTool(id, params, run);
    case "server/discover":
      // A modern client probing a request without the version header. Tell it
      // what we speak so it can retry as a modern request.
      return {
        status: 400,
        body: err(id, UNSUPPORTED_VERSION, "Unsupported protocol version", {
          supported: SUPPORTED_VERSIONS,
          requested: version ?? null,
        }),
      };
    default:
      return {
        status: 200,
        body: err(id, METHOD_NOT_FOUND, `Method not found: ${method || "(missing method)"}`),
      };
  }
}
