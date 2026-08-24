import { describe, expect, it } from "vitest";

import {
  readCreatePairingResponse,
  readPollPairingResponse,
} from "../apps/agent/src/connection/clientPairingResponseReaders.js";

describe("client pairing response readers", () => {
  it("accepts valid session and approval responses", () => {
    expect(
      readCreatePairingResponse({
        deviceCode: "d".repeat(43),
        expiresAt: "2026-12-01T12:00:00.000Z",
        pollIntervalSeconds: 5,
        userCode: "ABCD-2345",
      }),
    ).toMatchObject({ userCode: "ABCD-2345" });
    expect(
      readPollPairingResponse({
        clientId: "client-1",
        clientSecret: "s".repeat(43),
        heartbeatIntervalSeconds: 30,
        status: "approved",
      }),
    ).toMatchObject({ clientId: "client-1", status: "approved" });
  });

  it("accepts terminal responses without credentials", () => {
    expect(readPollPairingResponse({ status: "expired" })).toEqual({ status: "expired" });
    expect(readPollPairingResponse({ status: "rejected" })).toEqual({ status: "rejected" });
    expect(readPollPairingResponse({ status: "consumed" })).toEqual({ status: "consumed" });
  });

  it("rejects malformed codes and credentials", () => {
    expect(() =>
      readCreatePairingResponse({
        deviceCode: "short",
        expiresAt: "invalid",
        pollIntervalSeconds: 0,
        userCode: "ABCD-1234",
      }),
    ).toThrow("invalid pairing response");
    expect(() =>
      readPollPairingResponse({ clientId: "client-1", clientSecret: "short", status: "approved" }),
    ).toThrow("invalid pairing response");
  });
});
