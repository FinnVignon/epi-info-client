import { ServerApiError } from "./serverApiError.js";

export function resolveServerAssetUrl(serverBaseUrl: string, remoteUrl: string): string {
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
