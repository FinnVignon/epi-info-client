import type {
  CreateClientPairingResponse,
  PollClientPairingResponse,
} from "../../../shared/clientPairingContracts.js";
import { ServerApiError } from "./serverApiError.js";

export function readCreatePairingResponse(value: unknown): CreateClientPairingResponse {
  if (typeof value !== "object" || value === null) {
    throw invalidPairingResponse();
  }

  const response = value as Partial<CreateClientPairingResponse>;

  if (
    typeof response.deviceCode !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(response.deviceCode) ||
    typeof response.userCode !== "string" ||
    !/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(response.userCode) ||
    !isValidDate(response.expiresAt) ||
    !isPositiveInteger(response.pollIntervalSeconds)
  ) {
    throw invalidPairingResponse();
  }

  return response as CreateClientPairingResponse;
}

export function readPollPairingResponse(value: unknown): PollClientPairingResponse {
  if (typeof value !== "object" || value === null || !("status" in value)) {
    throw invalidPairingResponse();
  }

  const response = value as Partial<PollClientPairingResponse>;

  if (response.status === "pending") {
    if (!isValidDate(response.expiresAt) || !isPositiveInteger(response.pollIntervalSeconds)) {
      throw invalidPairingResponse();
    }

    return response as PollClientPairingResponse;
  }

  if (response.status === "approved") {
    if (
      typeof response.clientId !== "string" ||
      response.clientId.length === 0 ||
      typeof response.clientSecret !== "string" ||
      response.clientSecret.length < 32 ||
      !isPositiveInteger(response.heartbeatIntervalSeconds)
    ) {
      throw invalidPairingResponse();
    }

    return response as PollClientPairingResponse;
  }

  if (
    response.status === "consumed" ||
    response.status === "expired" ||
    response.status === "rejected"
  ) {
    return { status: response.status };
  }

  throw invalidPairingResponse();
}

function invalidPairingResponse(): ServerApiError {
  return new ServerApiError("Server returned an invalid pairing response", 200);
}

function isValidDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
