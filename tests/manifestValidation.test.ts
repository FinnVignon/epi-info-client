import { describe, expect, it } from "vitest";

import { isManifest } from "../apps/agent/src/manifest/manifestValidation.js";

const validMediaManifest = {
  id: "manifest-1",
  items: [
    {
      assetId: "asset-1",
      durationSeconds: 30,
      fit: "contain",
      id: "item-1",
      localPath: "/assets/asset-1.png",
      remoteUrl: "/api/clients/assets/asset-1",
      sha256: "a".repeat(64),
      type: "image",
    },
  ],
  name: "Information",
  version: 1,
};

describe("manifest validation", () => {
  it("accepts valid media and live-link manifests", () => {
    expect(isManifest(validMediaManifest)).toBe(true);
    expect(
      isManifest({
        ...validMediaManifest,
        items: [
          {
            durationSeconds: 30,
            id: "link-1",
            refreshSeconds: 60,
            type: "live_web_link",
            url: "https://example.com/status",
          },
        ],
      }),
    ).toBe(true);
  });

  it.each([
    "/assets/../secret",
    "/assets/%2e%2e/secret",
    "/assets/folder\\secret",
    "/assets/file.png?download=1",
  ])("rejects unsafe local asset path %s", (localPath) => {
    expect(
      isManifest({
        ...validMediaManifest,
        items: [{ ...validMediaManifest.items[0], localPath }],
      }),
    ).toBe(false);
  });

  it("rejects unsafe live links and non-positive refresh rates", () => {
    expect(
      isManifest({
        ...validMediaManifest,
        items: [
          {
            durationSeconds: 30,
            id: "link-1",
            refreshSeconds: 0,
            type: "live_web_link",
            url: "javascript:alert(1)",
          },
        ],
      }),
    ).toBe(false);
  });
});
