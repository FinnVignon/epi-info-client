import WebSocket from "ws";

import type { ClientConfig } from "../config.js";
import type { ClientIdentity } from "../storage/clientIdentityStore.js";
import type { SyncNotificationManager } from "./syncNotifications.js";
import type { ClientLiveEvent } from "../../../shared/clientContracts.js";

interface ClientLiveUpdateConnectionHandlers {
  onAssignmentChanged: () => void;
}

export interface ClientLiveUpdateConnection {
  start(identity: ClientIdentity, handlers: ClientLiveUpdateConnectionHandlers): void;
  stop(): void;
}

interface ClientLiveUpdateConnectionDependencies {
  config: ClientConfig;
  notifications: SyncNotificationManager;
}

export function createClientLiveUpdateConnection({
  config,
  notifications,
}: ClientLiveUpdateConnectionDependencies): ClientLiveUpdateConnection {
  let handlers: ClientLiveUpdateConnectionHandlers | null = null;
  let identity: ClientIdentity | null = null;
  let reconnectTimer: NodeJS.Timeout | null = null;
  let retrySeconds = config.retryMinSeconds;
  let socket: WebSocket | null = null;
  let stopped = false;

  return {
    start(nextIdentity: ClientIdentity, nextHandlers: ClientLiveUpdateConnectionHandlers): void {
      identity = nextIdentity;
      handlers = nextHandlers;
      stopped = false;
      retrySeconds = config.retryMinSeconds;
      connect();
    },

    stop(): void {
      stopped = true;
      clearReconnectTimer();

      if (socket) {
        socket.removeAllListeners();
        socket.close();
        socket = null;
      }
    },
  };

  function connect(): void {
    if (stopped || !identity) {
      return;
    }

    clearReconnectTimer();

    const nextSocket = new WebSocket(createLiveUpdateUrl(config.serverBaseUrl), {
      handshakeTimeout: config.requestTimeoutMs,
      headers: {
        Authorization: `Bearer ${identity.clientSecret}`,
        "X-Client-Id": identity.clientId,
      },
    });

    socket = nextSocket;

    nextSocket.on("open", () => {
      retrySeconds = config.retryMinSeconds;
    });
    nextSocket.on("message", (data) => handleMessage(data));
    nextSocket.on("close", () => scheduleReconnect());
    nextSocket.on("error", () => {
      nextSocket.close();
    });
  }

  function handleMessage(data: WebSocket.RawData): void {
    const event = readLiveEvent(data);

    if (!event || !identity || !handlers) {
      return;
    }

    if (event.type === "assignment.changed" && event.clientId === identity.clientId) {
      notifications.showAssignmentSignal();
      handlers.onAssignmentChanged();
    }
  }

  function scheduleReconnect(): void {
    if (stopped) {
      return;
    }

    clearReconnectTimer();

    const delaySeconds = retrySeconds;
    retrySeconds = Math.min(config.retryMaxSeconds, retrySeconds * 2);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delaySeconds * 1000);
  }

  function clearReconnectTimer(): void {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }
}

function createLiveUpdateUrl(serverBaseUrl: string): string {
  const url = new URL("/api/clients/live", `${serverBaseUrl}/`);

  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";

  return url.toString();
}

function readLiveEvent(data: WebSocket.RawData): ClientLiveEvent | null {
  try {
    const event = JSON.parse(data.toString()) as Partial<ClientLiveEvent>;

    if (event.type === "server.hello" && event.service === "epi-info-server") {
      return {
        serverTime: typeof event.serverTime === "string" ? event.serverTime : "",
        service: "epi-info-server",
        type: "server.hello",
      };
    }

    if (
      event.type === "assignment.changed" &&
      typeof event.clientId === "string" &&
      typeof event.sentAt === "string"
    ) {
      return {
        clientId: event.clientId,
        sentAt: event.sentAt,
        type: "assignment.changed",
      };
    }
  } catch {
    return null;
  }

  return null;
}
