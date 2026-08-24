export type ClientPairingTerminalStatus = "consumed" | "expired" | "rejected";

export interface CreateClientPairingRequest {
  name: string;
  softwareVersion?: string;
}

export interface CreateClientPairingResponse {
  deviceCode: string;
  expiresAt: string;
  pollIntervalSeconds: number;
  userCode: string;
}

export interface PollClientPairingRequest {
  deviceCode: string;
}

export interface PendingClientPairingResponse {
  expiresAt: string;
  pollIntervalSeconds: number;
  status: "pending";
}

export interface ApprovedClientPairingResponse {
  clientId: string;
  clientSecret: string;
  heartbeatIntervalSeconds: number;
  status: "approved";
}

export interface TerminalClientPairingResponse {
  status: ClientPairingTerminalStatus;
}

export type PollClientPairingResponse =
  | ApprovedClientPairingResponse
  | PendingClientPairingResponse
  | TerminalClientPairingResponse;
