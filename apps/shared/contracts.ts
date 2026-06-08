export const SUPPORTED_MANIFEST_ITEM_TYPES = ["image", "video", "text", "webpage"] as const;

export type ManifestItemType = (typeof SUPPORTED_MANIFEST_ITEM_TYPES)[number];

export type FitMode = "contain" | "cover";

export interface BaseManifestItem {
  durationSeconds: number;
  id: string;
  type: ManifestItemType;
}

export interface MediaManifestItem extends BaseManifestItem {
  assetId: string;
  fit: FitMode;
  localPath: string;
  remoteUrl: string;
  sha256: string;
  type: "image" | "video";
}

export interface TextManifestItem extends BaseManifestItem {
  text: string;
  type: "text";
}

export interface WebPageManifestItem extends BaseManifestItem {
  type: "webpage";
  url: string;
}

export type ManifestItem = MediaManifestItem | TextManifestItem | WebPageManifestItem;

export interface Manifest {
  id: string;
  items: ManifestItem[];
  name: string;
  version: number;
}

