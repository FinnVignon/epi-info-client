import type {
  CreateClientPairingRequest,
  CreateClientPairingResponse,
  PollClientPairingResponse,
} from "../../../shared/clientPairingContracts.js";
import {
  readCreatePairingResponse,
  readPollPairingResponse,
} from "./clientPairingResponseReaders.js";
import { requestServerJson } from "./serverRequest.js";

export interface ClientPairingApi {
  create(request: CreateClientPairingRequest): Promise<CreateClientPairingResponse>;
  poll(deviceCode: string): Promise<PollClientPairingResponse>;
}

export function createClientPairingApi(
  serverBaseUrl: string,
  requestTimeoutMs: number,
): ClientPairingApi {
  const pairingUrl = `${serverBaseUrl.replace(/\/+$/, "")}/api/clients/pairing-sessions`;

  return {
    async create(request): Promise<CreateClientPairingResponse> {
      return readCreatePairingResponse(await postJson(pairingUrl, request, requestTimeoutMs));
    },
    async poll(deviceCode): Promise<PollClientPairingResponse> {
      return readPollPairingResponse(
        await postJson(`${pairingUrl}/poll`, { deviceCode }, requestTimeoutMs),
      );
    },
  };
}

function postJson(url: string, body: unknown, timeoutMs: number): Promise<unknown> {
  return requestServerJson(
    url,
    {
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    },
    timeoutMs,
  );
}
