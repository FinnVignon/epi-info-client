import cors from "cors";
import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import type { Server } from "node:http";

import { SUPPORTED_MANIFEST_ITEM_TYPES } from "../../../shared/contracts.js";
import type { ClientConfig } from "../config.js";
import type { ClientConnectionStatus } from "../connection/connectionStatus.js";
import type { ClientPaths } from "../storage/clientPaths.js";
import type { ManifestStore } from "../storage/manifestStore.js";

interface LocalDisplayServerDependencies {
  config: ClientConfig;
  connectionStatus: ClientConnectionStatus;
  manifestStore: ManifestStore;
  paths: ClientPaths;
}

export async function startLocalDisplayServer({
  config,
  connectionStatus,
  manifestStore,
  paths,
}: LocalDisplayServerDependencies): Promise<Server> {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use("/assets", express.static(paths.assetsPath));

  app.get("/api/health", (_request, response) => {
    response.json({
      activeManifestPath: paths.activeManifestPath,
      connection: connectionStatus.getSnapshot(),
      kioskUrl: config.kioskUrl,
      serverBaseUrl: config.serverBaseUrl,
      service: "epi-info-client-agent",
      supportedManifestItemTypes: SUPPORTED_MANIFEST_ITEM_TYPES,
    });
  });

  app.get("/api/manifest", (_request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.json(manifestStore.getActiveManifest());
  });

  mountDisplayApp(app, config.displayDistPath);

  return new Promise((resolve, reject) => {
    const server = app.listen(config.displayPort, () => {
      console.info(`Epi Info client agent listening on port ${config.displayPort}`);
      resolve(server);
    });

    server.once("error", reject);
  });
}

function mountDisplayApp(app: express.Express, displayDistPath: string | undefined): void {
  if (displayDistPath && existsSync(displayDistPath)) {
    const resolvedDisplayDistPath = path.resolve(displayDistPath);

    app.use(express.static(resolvedDisplayDistPath));
    app.get("*", (request, response, next) => {
      if (request.path.startsWith("/api") || request.path.startsWith("/assets")) {
        next();
        return;
      }

      response.sendFile(path.join(resolvedDisplayDistPath, "index.html"));
    });
    return;
  }

  app.get("/", (_request, response) => {
    response
      .type("html")
      .send('<!doctype html><title>Epi Info Client</title><div id="root"></div>');
  });
}
