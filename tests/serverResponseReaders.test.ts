import { describe, expect, it } from "vitest";

import {
  readEffectiveManifestResponse,
  readHeartbeatResponse,
} from "../apps/agent/src/connection/serverResponseReaders.js";

describe("server response readers", () => {
  it("accepts valid heartbeat responses", () => {
    expect(
      readHeartbeatResponse({
        heartbeatIntervalSeconds: 30,
        serverTime: "2026-01-01T00:00:00.000Z",
      }),
    ).toEqual({
      heartbeatIntervalSeconds: 30,
      serverTime: "2026-01-01T00:00:00.000Z",
    });
  });

  it("rejects malformed heartbeat responses", () => {
    expect(() =>
      readHeartbeatResponse({ heartbeatIntervalSeconds: 0, serverTime: "invalid" }),
    ).toThrow("Server returned an invalid heartbeat response");
  });

  it("accepts a valid manifest and rejects malformed manifest data", () => {
    expect(
      readEffectiveManifestResponse({
        manifest: {
          id: "manifest-1",
          items: [
            {
              durationSeconds: 30,
              id: "link-1",
              refreshSeconds: 60,
              type: "live_web_link",
              url: "https://example.com",
            },
          ],
          name: "Status",
          version: 1,
        },
      }).manifest?.id,
    ).toBe("manifest-1");

    expect(() => readEffectiveManifestResponse({ manifest: { id: "broken" } })).toThrow(
      "Server returned an invalid manifest response",
    );
  });
});
