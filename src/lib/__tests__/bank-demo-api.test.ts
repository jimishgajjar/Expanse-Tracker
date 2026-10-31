import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  workspace: vi.fn(),
  read: vi.fn(),
  change: vi.fn(),
  store: vi.fn(),
}));
vi.mock("../workspace", () => ({ getActiveWorkspace: mocks.workspace }));
vi.mock("../bank-demo/store", () => ({ getDemoStore: mocks.store }));
import { GET, POST } from "@/app/api/bank-demo/route";
import { DemoError } from "../bank-demo/model";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("BANK_SYNC_MODE", "demo");
  vi.stubEnv("PGLITE_PATH", ".pglite-preview");
  mocks.workspace.mockResolvedValue({ id: "owner-workspace", role: "owner" });
  mocks.store.mockReturnValue({ read: mocks.read, change: mocks.change });
  mocks.read.mockResolvedValue({ version: 0 });
  mocks.change.mockResolvedValue({ version: 1 });
});
afterEach(() => {
  vi.unstubAllEnvs();
});
const request = (
  body = JSON.stringify({ version: 0, command: { type: "reset" } }),
  origin = "http://localhost:3107",
) =>
  new Request("http://localhost:3107/api/bank-demo", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body,
  });

describe("bank demo API boundary", () => {
  it("accepts the browser host when the local server normalizes its internal URL", async () => {
    const proxied = new Request("http://localhost:3107/api/bank-demo", {
      method: "POST",
      headers: { host: "127.0.0.1:3107", origin: "http://127.0.0.1:3107", "content-type": "application/json" },
      body: JSON.stringify({ version: 0, command: { type: "reset" } }),
    });
    expect((await POST(proxied)).status).toBe(200);
  });
  it("does not even look up a workspace or open storage in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect((await GET()).status).toBe(404);
    expect((await POST(request())).status).toBe(404);
    expect(mocks.workspace).not.toHaveBeenCalled();
    expect(mocks.store).not.toHaveBeenCalled();
  });
  it.each([
    null,
    { id: "other", role: "member" },
    { id: "other", role: "viewer" },
  ])("rejects unauthenticated or non-owner access: %s", async (workspace) => {
    mocks.workspace.mockResolvedValue(workspace);
    expect((await GET()).status).toBe(403);
    expect((await POST(request())).status).toBe(403);
    expect(mocks.store).not.toHaveBeenCalled();
  });
  it("derives workspace authority from the session, never a submitted workspace ID", async () => {
    const response = await POST(
      request(
        JSON.stringify({
          version: 0,
          workspaceId: "victim",
          command: { type: "reset" },
        }),
      ),
    );
    expect(response.status).toBe(200);
    expect(mocks.change).toHaveBeenCalledWith("owner-workspace", 0, {
      type: "reset",
    });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it("rejects cross-origin and missing-origin actions before database access", async () => {
    expect(
      (await POST(request(undefined, "https://evil.example"))).status,
    ).toBe(403);
    expect((await POST(request(undefined, ""))).status).toBe(403);
    expect(mocks.workspace).not.toHaveBeenCalled();
  });
  it("bounds body bytes and validates JSON and commands", async () => {
    expect((await POST(request("x".repeat(8193)))).status).toBe(413);
    expect((await POST(request("not json"))).status).toBe(400);
    expect(
      (
        await POST(
          request(JSON.stringify({ version: -1, command: { type: "reset" } })),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await POST(
          request(
            JSON.stringify({ version: 0, command: { type: "drop-database" } }),
          ),
        )
      ).status,
    ).toBe(400);
    expect(mocks.change).not.toHaveBeenCalled();
  });
  it("returns explicit stale-state conflicts and hides unexpected infrastructure details", async () => {
    mocks.change.mockRejectedValue(
      new DemoError("The demo changed in another tab."),
    );
    expect((await POST(request())).status).toBe(409);
    mocks.change.mockRejectedValue(new Error("private database detail"));
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("private database detail");
  });
});
