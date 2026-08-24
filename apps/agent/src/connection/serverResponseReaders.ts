import type {
  ClientHeartbeatResponse,
  EffectiveManifestResponse,
} from "../../../shared/clientContracts.js";
import { isManifest } from "../manifest/manifestValidation.js";
import { ServerApiError } from "./serverApiError.js";

export function readHeartbeatResponse(value: unknown): ClientHeartbeatResponse {
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

export function readEffectiveManifestResponse(value: unknown): EffectiveManifestResponse {
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

function isPositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && typeof value === "number" && value > 0;
}
