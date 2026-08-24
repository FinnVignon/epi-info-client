import type {
  ClientHeartbeatRequest,
  ClientHeartbeatResponse,
  EffectiveManifestResponse,
  RegisterClientRequest,
  RegisterClientResponse,
} from "../../../shared/clientContracts.js";
import type { ClientIdentity } from "../storage/clientIdentityStore.js";
import { resolveServerAssetUrl } from "./serverAssetUrls.js";
import { downloadServerFile, requestServerJson } from "./serverRequest.js";
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
      await downloadServerFile(
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
      const response = await requestServerJson(
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
      const response = await requestServerJson(
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
      const response = await requestServerJson(
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
