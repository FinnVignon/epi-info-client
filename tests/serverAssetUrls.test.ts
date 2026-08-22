import { describe, expect, it } from "vitest";

import { resolveServerAssetUrl } from "../apps/agent/src/connection/serverAssetUrls.js";

describe("server asset URL resolution", () => {
  it("accepts client asset endpoints on the configured origin", () => {
    expect(resolveServerAssetUrl("https://server.example", "/api/clients/assets/asset-1")).toBe(
      "https://server.example/api/clients/assets/asset-1",
    );
  });

  it("rejects assets from another origin", () => {
    expect(() =>
      resolveServerAssetUrl(
        "https://server.example",
        "https://attacker.example/api/clients/assets/asset-1",
      ),
    ).toThrow("Manifest asset URL must use the configured server origin");
  });

  it("rejects same-origin URLs outside the client asset endpoint", () => {
    expect(() => resolveServerAssetUrl("https://server.example", "/admin/private-file")).toThrow(
      "Manifest asset URL is not a client asset endpoint",
    );
  });
});
