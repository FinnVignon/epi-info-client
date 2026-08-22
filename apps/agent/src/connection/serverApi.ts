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
import type { ClientIdentity } from "../storage/clientIdentityStore.js";
import { resolveServerAssetUrl } from "./serverAssetUrls.js";
import { ServerApiError } from "./serverApiError.js";
import {
  readEffectiveManifestResponse,
  readHeartbeatResponse,
  readRegistrationResponse,
} from "./serverResponseReaders.js";

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
