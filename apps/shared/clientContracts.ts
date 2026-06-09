import type { Manifest } from "./contracts.js";

export interface RegisterClientRequest {
  enrollmentToken: string;
  name: string;
  softwareVersion?: string;
}

export interface RegisterClientResponse {
  clientId: string;
  clientSecret: string;
  heartbeatIntervalSeconds: number;
}

export interface ClientHeartbeatRequest {
  currentManifestId?: string | null;
  currentManifestVersion?: number | null;
  lastError?: string | null;
  lastSyncResult?: string | null;
  softwareVersion?: string;
}

export interface ClientHeartbeatResponse {
  heartbeatIntervalSeconds: number;
  serverTime: string;
}

export interface EffectiveManifestResponse {
  manifest: Manifest | null;
}
