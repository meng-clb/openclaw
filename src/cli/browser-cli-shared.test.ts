import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchBrowserJson: vi.fn(async () => ({ ok: true })),
  callGatewayFromCli: vi.fn(async () => ({ ok: true })),
  loadConfig: vi.fn(() => ({ gateway: { mode: "local" as const } })),
  resolveGatewayPort: vi.fn(() => 18789),
  deriveDefaultBrowserControlPort: vi.fn(() => 18791),
}));

vi.mock("../browser/client-fetch.js", () => ({
  fetchBrowserJson: mocks.fetchBrowserJson,
}));

vi.mock("../config/config.js", () => ({
  loadConfig: mocks.loadConfig,
}));

vi.mock("../config/paths.js", () => ({
  resolveGatewayPort: mocks.resolveGatewayPort,
}));

vi.mock("../config/port-defaults.js", () => ({
  deriveDefaultBrowserControlPort: mocks.deriveDefaultBrowserControlPort,
}));

vi.mock("./gateway-rpc.js", () => ({
  callGatewayFromCli: mocks.callGatewayFromCli,
}));

import { callBrowserRequest } from "./browser-cli-shared.js";

describe("callBrowserRequest", () => {
  const originalGatewayUrl = process.env.OPENCLAW_GATEWAY_URL;
  const originalLegacyGatewayUrl = process.env.CLAWDBOT_GATEWAY_URL;

  beforeEach(() => {
    mocks.fetchBrowserJson.mockClear();
    mocks.callGatewayFromCli.mockClear();
    mocks.loadConfig.mockReset();
    mocks.loadConfig.mockReturnValue({ gateway: { mode: "local" } });
    mocks.resolveGatewayPort.mockClear();
    mocks.resolveGatewayPort.mockReturnValue(18789);
    mocks.deriveDefaultBrowserControlPort.mockClear();
    mocks.deriveDefaultBrowserControlPort.mockReturnValue(18791);
    delete process.env.OPENCLAW_GATEWAY_URL;
    delete process.env.CLAWDBOT_GATEWAY_URL;
  });

  afterEach(() => {
    if (originalGatewayUrl === undefined) {
      delete process.env.OPENCLAW_GATEWAY_URL;
    } else {
      process.env.OPENCLAW_GATEWAY_URL = originalGatewayUrl;
    }
    if (originalLegacyGatewayUrl === undefined) {
      delete process.env.CLAWDBOT_GATEWAY_URL;
    } else {
      process.env.CLAWDBOT_GATEWAY_URL = originalLegacyGatewayUrl;
    }
  });

  it("uses local browser control for local gateway mode without URL overrides", async () => {
    await callBrowserRequest(
      { timeout: "5000", token: "local-token" },
      {
        method: "POST",
        path: "/tabs/open",
        query: { profile: "openclaw", limit: 1, compact: true, ignored: undefined },
        body: { url: "https://example.com" },
      },
      { timeoutMs: 15000 },
    );

    expect(mocks.callGatewayFromCli).not.toHaveBeenCalled();
    expect(mocks.fetchBrowserJson).toHaveBeenCalledTimes(1);
    const [url, init] = mocks.fetchBrowserJson.mock.calls[0] as [
      string,
      { method: string; headers?: HeadersInit; body?: string; timeoutMs?: number },
    ];
    expect(url).toBe("http://127.0.0.1:18791/tabs/open?profile=openclaw&limit=1&compact=true");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ url: "https://example.com" }));
    expect(init.timeoutMs).toBe(15000);
    const headers = new Headers(init.headers);
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("Authorization")).toBe("Bearer local-token");
  });

  it("falls back to gateway RPC when an explicit gateway URL override is present", async () => {
    process.env.OPENCLAW_GATEWAY_URL = "ws://gateway.example.test";

    await callBrowserRequest(
      { timeout: "5000" },
      {
        method: "GET",
        path: "/tabs",
        query: { profile: "openclaw" },
      },
      { timeoutMs: 3000, progress: false },
    );

    expect(mocks.fetchBrowserJson).not.toHaveBeenCalled();
    expect(mocks.callGatewayFromCli).toHaveBeenCalledWith(
      "browser.request",
      { timeout: "3000" },
      {
        method: "GET",
        path: "/tabs",
        query: { profile: "openclaw" },
        body: undefined,
        timeoutMs: 3000,
      },
      { progress: false },
    );
  });
});
