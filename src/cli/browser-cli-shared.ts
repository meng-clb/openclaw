import type { GatewayRpcOpts } from "./gateway-rpc.js";
import { fetchBrowserJson } from "../browser/client-fetch.js";
import { deriveDefaultBrowserControlPort } from "../config/port-defaults.js";
import { resolveGatewayPort } from "../config/paths.js";
import { loadConfig } from "../config/config.js";
import { callGatewayFromCli } from "./gateway-rpc.js";

export type BrowserParentOpts = GatewayRpcOpts & {
  json?: boolean;
  browserProfile?: string;
};

type BrowserRequestParams = {
  method: "GET" | "POST" | "DELETE";
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
};

function normalizeQuery(query: BrowserRequestParams["query"]): Record<string, string> | undefined {
  if (!query) {
    return undefined;
  }
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) {
      continue;
    }
    out[key] = String(value);
  }
  return Object.keys(out).length ? out : undefined;
}

function shouldUseLocalBrowserControl(opts: BrowserParentOpts): boolean {
  if (typeof opts.url === "string" && opts.url.trim().length > 0) {
    return false;
  }
  if (typeof process.env.OPENCLAW_GATEWAY_URL === "string" && process.env.OPENCLAW_GATEWAY_URL.trim()) {
    return false;
  }
  if (typeof process.env.CLAWDBOT_GATEWAY_URL === "string" && process.env.CLAWDBOT_GATEWAY_URL.trim()) {
    return false;
  }
  const cfg = loadConfig();
  return cfg.gateway?.mode !== "remote";
}

function buildLocalBrowserControlUrl(params: BrowserRequestParams): string {
  const cfg = loadConfig();
  const gatewayPort = resolveGatewayPort(cfg, process.env);
  const controlPort = deriveDefaultBrowserControlPort(gatewayPort);
  const url = new URL(`http://127.0.0.1:${controlPort}`);
  url.pathname = params.path.startsWith("/") ? params.path : `/${params.path}`;
  for (const [key, value] of Object.entries(normalizeQuery(params.query) ?? {})) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

async function callLocalBrowserControl<T>(
  opts: BrowserParentOpts,
  params: BrowserRequestParams,
  timeoutMs: number | undefined,
): Promise<T> {
  const headers = new Headers();
  let body: string | undefined;
  if (params.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(params.body);
  }
  if (typeof opts.token === "string" && opts.token.trim().length > 0) {
    headers.set("Authorization", `Bearer ${opts.token.trim()}`);
  }
  return await fetchBrowserJson<T>(buildLocalBrowserControlUrl(params), {
    method: params.method,
    headers,
    body,
    timeoutMs,
  });
}

export async function callBrowserRequest<T>(
  opts: BrowserParentOpts,
  params: BrowserRequestParams,
  extra?: { timeoutMs?: number; progress?: boolean },
): Promise<T> {
  const resolvedTimeoutMs =
    typeof extra?.timeoutMs === "number" && Number.isFinite(extra.timeoutMs)
      ? Math.max(1, Math.floor(extra.timeoutMs))
      : typeof opts.timeout === "string"
        ? Number.parseInt(opts.timeout, 10)
        : undefined;
  const resolvedTimeout =
    typeof resolvedTimeoutMs === "number" && Number.isFinite(resolvedTimeoutMs)
      ? resolvedTimeoutMs
      : undefined;
  if (shouldUseLocalBrowserControl(opts)) {
    return await callLocalBrowserControl<T>(opts, params, resolvedTimeout);
  }
  const timeout = typeof resolvedTimeout === "number" ? String(resolvedTimeout) : opts.timeout;
  const payload = await callGatewayFromCli(
    "browser.request",
    { ...opts, timeout },
    {
      method: params.method,
      path: params.path,
      query: normalizeQuery(params.query),
      body: params.body,
      timeoutMs: resolvedTimeout,
    },
    { progress: extra?.progress },
  );
  if (payload === undefined) {
    throw new Error("Unexpected browser.request response");
  }
  return payload as T;
}

export async function callBrowserResize(
  opts: BrowserParentOpts,
  params: { profile?: string; width: number; height: number; targetId?: string },
  extra?: { timeoutMs?: number },
): Promise<unknown> {
  return callBrowserRequest(
    opts,
    {
      method: "POST",
      path: "/act",
      query: params.profile ? { profile: params.profile } : undefined,
      body: {
        kind: "resize",
        width: params.width,
        height: params.height,
        targetId: params.targetId?.trim() || undefined,
      },
    },
    extra,
  );
}
