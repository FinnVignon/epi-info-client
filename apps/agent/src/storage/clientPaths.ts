import path from "node:path";

export interface ClientPaths {
  activeManifestPath: string;
  assetsPath: string;
  identityPath: string;
  manifestsPath: string;
}

export function createClientPaths(dataPath: string): ClientPaths {
  const resolvedDataPath = path.resolve(dataPath);
  const manifestsPath = path.join(resolvedDataPath, "manifests");

  return {
    activeManifestPath: path.join(manifestsPath, "active-manifest.json"),
    assetsPath: path.join(resolvedDataPath, "assets"),
    identityPath: path.join(resolvedDataPath, "client-identity.json"),
    manifestsPath,
  };
}
