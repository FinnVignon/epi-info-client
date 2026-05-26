import cors from "cors";
import express from "express";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { readConfig } from "./config.js";
import { Manifest, SUPPORTED_MANIFEST_ITEM_TYPES } from "../../shared/contracts.js";

const config = readConfig();
const assetsPath = path.join(config.dataPath, "assets");
const manifestsPath = path.join(config.dataPath, "manifests");
const activeManifestPath = path.join(manifestsPath, "active-manifest.json");

mkdirSync(assetsPath, { recursive: true });
mkdirSync(manifestsPath, { recursive: true });

const fallbackManifest: Manifest = {
  id: "local-fallback",
  items: [
    {
      durationSeconds: 30,
      id: "fallback-text",
      text: "No manifest assigned",
      type: "text",
    },
  ],
  name: "Local fallback",
  version: 1,
};

function readActiveManifest(): Manifest {
  if (!existsSync(activeManifestPath)) {
    writeFileSync(activeManifestPath, `${JSON.stringify(fallbackManifest, null, 2)}\n`, "utf8");
    return fallbackManifest;
  }

  return JSON.parse(readFileSync(activeManifestPath, "utf8")) as Manifest;
}

const app = express();

app.use(cors());
app.use(express.json());
app.use("/assets", express.static(assetsPath));

app.get("/api/health", (_request, response) => {
  response.json({
    activeManifestPath,
    kioskUrl: config.kioskUrl,
    serverBaseUrl: config.serverBaseUrl,
    service: "epi-info-client-agent",
    supportedManifestItemTypes: SUPPORTED_MANIFEST_ITEM_TYPES,
  });
});

app.get("/api/manifest", (_request, response) => {
  response.json(readActiveManifest());
});

if (config.displayDistPath && existsSync(config.displayDistPath)) {
  const displayDistPath = path.resolve(config.displayDistPath);

  app.use(express.static(displayDistPath));
  app.get("*", (request, response, next) => {
    if (request.path.startsWith("/api") || request.path.startsWith("/assets")) {
      next();
      return;
    }

    response.sendFile(path.join(displayDistPath, "index.html"));
  });
} else {
  app.get("/", (_request, response) => {
    response.type("html").send("<!doctype html><title>Epi Info Client</title><div id=\"root\"></div>");
  });
}

app.listen(config.displayPort, () => {
  console.log(`Epi Info client agent listening on port ${config.displayPort}`);
});

