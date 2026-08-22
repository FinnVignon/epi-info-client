import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import type { Server } from "node:http";

import { SUPPORTED_MANIFEST_ITEM_TYPES } from "../../../shared/contracts.js";
import type { ClientConfig } from "../config.js";
import type { ClientConnectionStatus } from "../connection/connectionStatus.js";
import type { SyncNotificationManager } from "../connection/syncNotifications.js";
import type { AssetCache } from "../storage/assetCache.js";
import type { ClientPaths } from "../storage/clientPaths.js";
import type { ManifestStore } from "../storage/manifestStore.js";

interface LocalDisplayServerDependencies {
  assetCache: AssetCache;
  config: ClientConfig;
  connectionStatus: ClientConnectionStatus;
  manifestStore: ManifestStore;
  paths: ClientPaths;
  syncNotifications: SyncNotificationManager;
}

export async function startLocalDisplayServer({
  assetCache,
  config,
  connectionStatus,
  manifestStore,
  paths,
  syncNotifications,
}: LocalDisplayServerDependencies): Promise<Server> {
  const app = express();

  app.use(express.json());
  app.use("/assets", express.static(paths.assetsPath, { dotfiles: "deny" }));

  app.get("/api/health", (_request, response) => {
    response.json({
      connection: connectionStatus.getSnapshot(),
      kioskUrl: config.kioskUrl,
      service: "epi-info-client-agent",
      supportedManifestItemTypes: SUPPORTED_MANIFEST_ITEM_TYPES,
    });
  });

  app.get("/api/manifest", (_request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.json(manifestStore.getActiveManifest());
  });

  app.get("/api/sync/notification", (_request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.json(syncNotifications.getSnapshot());
  });

  app.post("/api/manifest/displayed", async (request, response, next) => {
    try {
      const activeManifest = manifestStore.getActiveManifest();

      if (
        request.body?.manifestId !== activeManifest.id ||
        request.body?.manifestVersion !== activeManifest.version
      ) {
        response.status(409).json({ error: "Displayed manifest is no longer active" });
        return;
      }

      await assetCache.deleteAssetsNotInManifest(activeManifest);
      syncNotifications.markDisplayed(activeManifest);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  mountDisplayApp(app, config.displayDistPath);

  return new Promise((resolve, reject) => {
    const server = app.listen(config.displayPort, config.displayHost, () => {
      console.info(
        `Epi Info client agent listening on ${config.displayHost}:${config.displayPort}`,
      );
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
