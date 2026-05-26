import "dotenv/config";

export interface ClientConfig {
  dataPath: string;
  displayDistPath?: string;
  displayPort: number;
  kioskUrl: string;
  serverBaseUrl: string;
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

export function readConfig(): ClientConfig {
  return {
    dataPath: process.env.CLIENT_DATA_PATH ?? "./data",
    displayDistPath: process.env.DISPLAY_DIST_PATH,
    displayPort: readNumber("CLIENT_DISPLAY_PORT", 3000),
    kioskUrl: process.env.KIOSK_URL ?? "http://localhost:3000",
    serverBaseUrl: process.env.SERVER_BASE_URL ?? "http://localhost:4000",
  };
}
