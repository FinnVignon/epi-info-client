import "dotenv/config";

export interface ClientConfig {
  assetDownloadTimeoutMs: number;
  clientName: string;
  dataPath: string;
  displayDistPath?: string;
  displayHost: string;
  displayPort: number;
  enrollmentToken?: string;
  heartbeatIntervalSeconds: number;
  kioskUrl: string;
  requestTimeoutMs: number;
  retryMaxSeconds: number;
  retryMinSeconds: number;
  serverBaseUrl: string;
  softwareVersion: string;
}

function readNumber(name: string, fallback: number): number {
  const rawValue = process.env[name];

  if (!rawValue) {
    return fallback;
  }

  const value = Number.parseInt(rawValue, 10);

  if (Number.isNaN(value)) {
    throw new Error(`${name} must be a number`);
  }

  return value;
}

function readPositiveNumber(name: string, fallback: number): number {
  const value = readNumber(name, fallback);

  if (value <= 0) {
    throw new Error(`${name} must be greater than 0`);
  }

  return value;
}

export function readConfig(): ClientConfig {
  const enrollmentToken = process.env.CLIENT_ENROLLMENT_TOKEN?.trim();
  const retryMaxSeconds = readPositiveNumber("CLIENT_RETRY_MAX_SECONDS", 60);
  const retryMinSeconds = readPositiveNumber("CLIENT_RETRY_MIN_SECONDS", 5);

  if (retryMinSeconds > retryMaxSeconds) {
    throw new Error("CLIENT_RETRY_MIN_SECONDS must not exceed CLIENT_RETRY_MAX_SECONDS");
  }

  return {
    assetDownloadTimeoutMs: readPositiveNumber("CLIENT_ASSET_DOWNLOAD_TIMEOUT_MS", 300_000),
    clientName: process.env.CLIENT_NAME?.trim() || "Epi Info Display",
    dataPath: process.env.CLIENT_DATA_PATH ?? "./data",
    displayDistPath: process.env.DISPLAY_DIST_PATH,
    displayHost: process.env.CLIENT_DISPLAY_HOST?.trim() || "127.0.0.1",
    displayPort: readPositiveNumber("CLIENT_DISPLAY_PORT", 3000),
    ...(enrollmentToken ? { enrollmentToken } : {}),
    heartbeatIntervalSeconds: readPositiveNumber("CLIENT_HEARTBEAT_INTERVAL_SECONDS", 30),
    kioskUrl: process.env.KIOSK_URL ?? "http://localhost:3000",
    requestTimeoutMs: readPositiveNumber("CLIENT_REQUEST_TIMEOUT_MS", 10_000),
    retryMaxSeconds,
    retryMinSeconds,
    serverBaseUrl: (process.env.SERVER_BASE_URL ?? "http://localhost:4000").replace(/\/+$/, ""),
    softwareVersion: process.env.CLIENT_SOFTWARE_VERSION?.trim() || "0.1.0",
  };
}
