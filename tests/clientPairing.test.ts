import { afterEach, describe, expect, it, vi } from "vitest";

import type { ClientConfig } from "../apps/agent/src/config.js";
import { createClientPairingController } from "../apps/agent/src/connection/clientPairing.js";
import { createClientPairingStatus } from "../apps/agent/src/connection/clientPairingStatus.js";

const pairing = {
  deviceCode: "d".repeat(43),
  expiresAt: "2026-12-01T12:00:00.000Z",
  pollIntervalSeconds: 5,
  userCode: "ABCD-2345",
};

describe("client pairing controller", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("saves a new session and exposes only its human code", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T12:00:00.000Z"));
    const dependencies = createDependencies(null);
    const controller = createClientPairingController(dependencies);

    controller.start(vi.fn());
    await vi.waitFor(() => expect(dependencies.api.create).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(dependencies.pairingStore.save).toHaveBeenCalledWith(pairing));

    expect(dependencies.status.getSnapshot()).toMatchObject({
      state: "pending",
      userCode: "ABCD-2345",
    });
    expect(JSON.stringify(dependencies.status.getSnapshot())).not.toContain(pairing.deviceCode);
    controller.stop();
  });

  it("resumes a saved session and persists approval before clearing it", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T12:00:00.000Z"));
    const dependencies = createDependencies(pairing);
    const onPaired = vi.fn();
    const controller = createClientPairingController(dependencies);

    controller.start(onPaired);
    await vi.waitFor(() => expect(dependencies.status.getSnapshot().state).toBe("pending"));
    await vi.advanceTimersByTimeAsync(5000);
    await vi.waitFor(() => expect(dependencies.identityStore.save).toHaveBeenCalledOnce());

    expect(dependencies.api.create).not.toHaveBeenCalled();
    expect(dependencies.pairingStore.clear).toHaveBeenCalledOnce();
    expect(onPaired).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: "client-1", clientSecret: "s".repeat(43) }),
    );
    controller.stop();
  });
});

function createDependencies(storedPairing: typeof pairing | null) {
  const status = createClientPairingStatus();

  return {
    api: {
      create: vi.fn().mockResolvedValue(pairing),
      poll: vi.fn().mockResolvedValue({
        clientId: "client-1",
        clientSecret: "s".repeat(43),
        heartbeatIntervalSeconds: 30,
        status: "approved",
      }),
    },
    config: {
      clientName: "Lobby display",
      retryMaxSeconds: 60,
      retryMinSeconds: 5,
      softwareVersion: "1.0.1",
    } as ClientConfig,
    identityStore: {
      load: vi.fn(),
      save: vi.fn().mockResolvedValue(undefined),
    },
    pairingStore: {
      clear: vi.fn().mockResolvedValue(undefined),
      load: vi.fn().mockResolvedValue(storedPairing),
      save: vi.fn().mockResolvedValue(undefined),
    },
    status,
  };
}
