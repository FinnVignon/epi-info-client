import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import type {
  ClientHeartbeatRequest,
  ClientHeartbeatResponse,
  EffectiveManifestResponse,
  RegisterClientRequest,
  RegisterClientResponse,
} from "../../../shared/clientContracts.js";
import { isManifest } from "../manifest/manifestValidation.js";
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
  downloadAsset(
    identity: ClientIdentity,
    remoteUrl: string,
    destinationPath: string,
  ): Promise<void>;
  getEffectiveManifest(identity: ClientIdentity): Promise<EffectiveManifestResponse>;
  register(request: RegisterClientRequest): Promise<RegisterClientResponse>;
  sendHeartbeat(
    identity: ClientIdentity,
    request: ClientHeartbeatRequest,
  ): Promise<ClientHeartbeatResponse>;
}

export function createClientServerApi(
  serverBaseUrl: string,
  requestTimeoutMs: number,
  assetDownloadTimeoutMs: number,
): ClientServerApi {
  const normalizedServerBaseUrl = serverBaseUrl.replace(/\/+$/, "");

  return {
    async downloadAsset(
      identity: ClientIdentity,
      remoteUrl: string,
      destinationPath: string,
    ): Promise<void> {
      await downloadAuthenticatedFile(
        resolveServerAssetUrl(normalizedServerBaseUrl, remoteUrl),
        {
          Authorization: `Bearer ${identity.clientSecret}`,
          "X-Client-Id": identity.clientId,
        },
        destinationPath,
        assetDownloadTimeoutMs,
      );
    },

    async getEffectiveManifest(identity: ClientIdentity): Promise<EffectiveManifestResponse> {
      const response = await requestJson(
        `${normalizedServerBaseUrl}/api/clients/manifest`,
        {
          headers: {
            Authorization: `Bearer ${identity.clientSecret}`,
            "X-Client-Id": identity.clientId,
          },
          method: "GET",
        },
        requestTimeoutMs,
      );

      return readEffectiveManifestResponse(response);
    },

    async register(request: RegisterClientRequest): Promise<RegisterClientResponse> {
      const response = await requestJson(
        `${normalizedServerBaseUrl}/api/clients/register`,
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
        `${normalizedServerBaseUrl}/api/clients/heartbeat`,
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

async function downloadAuthenticatedFile(
  url: string,
  headers: Record<string, string>,
  destinationPath: string,
  requestTimeoutMs: number,
): Promise<void> {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), requestTimeoutMs);

  try {
    const response = await fetch(url, {
      headers,
      method: "GET",
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new ServerApiError(
        readErrorMessage(await readResponseBody(response)),
        response.status,
        readRetryAfterSeconds(response.headers.get("retry-after")),
      );
    }

    if (!response.body) {
      throw new ServerApiError("Server returned an empty asset response", response.status);
    }

    await pipeline(Readable.fromWeb(response.body), createWriteStream(destinationPath));
  } catch (error) {
    if (error instanceof ServerApiError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new ServerApiError("Server request timed out", null);
    }

    throw new ServerApiError(
      error instanceof Error ? error.message : "Unable to download asset",
      null,
    );
  } finally {
    clearTimeout(timeout);
  }
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

function readEffectiveManifestResponse(value: unknown): EffectiveManifestResponse {
  if (typeof value !== "object" || value === null || !("manifest" in value)) {
    throw new ServerApiError("Server returned an invalid manifest response", 200);
  }

  const response = value as Partial<EffectiveManifestResponse>;

  if (response.manifest !== null && !isManifest(response.manifest)) {
    throw new ServerApiError("Server returned an invalid manifest response", 200);
  }

  return {
    manifest: response.manifest ?? null,
  };
}

function resolveServerAssetUrl(serverBaseUrl: string, remoteUrl: string): string {
  const baseUrl = new URL(`${serverBaseUrl}/`);
  const assetUrl = new URL(remoteUrl, baseUrl);

  if (assetUrl.origin !== baseUrl.origin) {
    throw new ServerApiError("Manifest asset URL must use the configured server origin", 200);
  }

  if (!assetUrl.pathname.startsWith("/api/clients/assets/")) {
    throw new ServerApiError("Manifest asset URL is not a client asset endpoint", 200);
  }

  return assetUrl.toString();
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
