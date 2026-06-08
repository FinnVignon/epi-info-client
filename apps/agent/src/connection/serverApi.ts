import type {
  ClientHeartbeatRequest,
  ClientHeartbeatResponse,
  RegisterClientRequest,
  RegisterClientResponse,
} from "../../../shared/clientContracts.js";
import type { ClientIdentity } from "../storage/clientIdentityStore.js";

export class ServerApiError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
    public readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
  }
}

export interface ClientServerApi {
  register(request: RegisterClientRequest): Promise<RegisterClientResponse>;
  sendHeartbeat(
    identity: ClientIdentity,
    request: ClientHeartbeatRequest,
  ): Promise<ClientHeartbeatResponse>;
}

export function createClientServerApi(
  serverBaseUrl: string,
  requestTimeoutMs: number,
): ClientServerApi {
  return {
    async register(request: RegisterClientRequest): Promise<RegisterClientResponse> {
      const response = await requestJson(
        `${serverBaseUrl}/api/clients/register`,
        {
          body: JSON.stringify(request),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        },
        requestTimeoutMs,
      );

      return readRegistrationResponse(response);
    },

    async sendHeartbeat(
      identity: ClientIdentity,
      request: ClientHeartbeatRequest,
    ): Promise<ClientHeartbeatResponse> {
      const response = await requestJson(
        `${serverBaseUrl}/api/clients/heartbeat`,
        {
          body: JSON.stringify(request),
          headers: {
            Authorization: `Bearer ${identity.clientSecret}`,
            "Content-Type": "application/json",
            "X-Client-Id": identity.clientId,
          },
          method: "POST",
        },
        requestTimeoutMs,
      );

      return readHeartbeatResponse(response);
    },
  };
}

async function requestJson(
  url: string,
  init: RequestInit,
  requestTimeoutMs: number,
): Promise<unknown> {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), requestTimeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: abortController.signal,
    });
    const body = await readResponseBody(response);

    if (!response.ok) {
      throw new ServerApiError(
        readErrorMessage(body),
        response.status,
        readRetryAfterSeconds(response.headers.get("retry-after")),
      );
    }

    return body;
  } catch (error) {
    if (error instanceof ServerApiError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new ServerApiError("Server request timed out", null);
    }

    throw new ServerApiError(
      error instanceof Error ? error.message : "Unable to contact the server",
      null,
    );
  } finally {
    clearTimeout(timeout);
  }
}

function readRegistrationResponse(value: unknown): RegisterClientResponse {
  if (typeof value !== "object" || value === null) {
    throw new ServerApiError("Server returned an invalid registration response", 200);
  }

  const response = value as Partial<RegisterClientResponse>;

  if (
    typeof response.clientId !== "string" ||
    response.clientId.length === 0 ||
    typeof response.clientSecret !== "string" ||
    response.clientSecret.length < 32 ||
    !isPositiveInteger(response.heartbeatIntervalSeconds)
  ) {
    throw new ServerApiError("Server returned an invalid registration response", 200);
  }

  return {
    clientId: response.clientId,
    clientSecret: response.clientSecret,
    heartbeatIntervalSeconds: response.heartbeatIntervalSeconds,
  };
}

function readHeartbeatResponse(value: unknown): ClientHeartbeatResponse {
  if (typeof value !== "object" || value === null) {
    throw new ServerApiError("Server returned an invalid heartbeat response", 200);
  }

  const response = value as Partial<ClientHeartbeatResponse>;

  if (
    !isPositiveInteger(response.heartbeatIntervalSeconds) ||
    typeof response.serverTime !== "string" ||
    Number.isNaN(Date.parse(response.serverTime))
  ) {
    throw new ServerApiError("Server returned an invalid heartbeat response", 200);
  }

  return {
    heartbeatIntervalSeconds: response.heartbeatIntervalSeconds,
    serverTime: response.serverTime,
  };
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ServerApiError("Server returned an invalid JSON response", response.status);
  }
}

function readErrorMessage(body: unknown): string {
  return typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "string"
    ? body.error
    : "Server request failed";
}

function readRetryAfterSeconds(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const seconds = Number.parseInt(value, 10);

  return Number.isSafeInteger(seconds) && seconds > 0 ? seconds : null;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && typeof value === "number" && value > 0;
}
