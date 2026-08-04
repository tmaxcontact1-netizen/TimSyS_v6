import { describe, expect, it, vi } from "vitest";

import { BoundedJsonHttpTransport } from "../../src/infrastructure/providers/http-json.js";

function transport(fetchImplementation: typeof fetch, maximumResponseBytes = 1_000) {
  return new BoundedJsonHttpTransport({
    allowedOrigins: new Set(["https://api.example"]),
    timeoutMs: 50,
    maximumResponseBytes,
    fetch: fetchImplementation,
  });
}

describe("bounded JSON HTTP transport", () => {
  it("allows only exact HTTPS origins and refuses redirects", async () => {
    const request = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) =>
        new Response("{}", { status: 200 }),
    );
    const client = transport(request as typeof fetch);
    await expect(client.get("https://evil.example/value")).rejects.toThrow(/allowlisted/);
    await expect(client.get("http://api.example/value")).rejects.toThrow(/allowlisted/);
    await client.get("https://api.example/value");
    expect(request.mock.calls[0]?.[1]).toMatchObject({ redirect: "error" });
  });

  it("decodes bounded JSON and preserves response status", async () => {
    const client = transport(
      async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 429,
          headers: { "content-type": "application/json" },
        }),
    );
    await expect(client.post("https://api.example/value", { id: 1 })).resolves.toMatchObject({
      status: 429,
      body: { ok: true },
    });
  });

  it("rejects oversized and malformed response bodies", async () => {
    await expect(
      transport(async () => new Response(JSON.stringify({ value: "large" })), 4).get(
        "https://api.example/value",
      ),
    ).rejects.toThrow(/size limit/);
    await expect(
      transport(async () => new Response("not-json")).get("https://api.example/value"),
    ).rejects.toThrow();
  });

  it("aborts requests that exceed the deadline", async () => {
    const client = transport(
      ((_input: string | URL | Request, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        })) as typeof fetch,
    );
    await expect(client.get("https://api.example/value")).rejects.toThrow(/aborted/);
  });
});
