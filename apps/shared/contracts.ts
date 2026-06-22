export const SUPPORTED_MANIFEST_ITEM_TYPES = ["image", "video", "text", "live_web_link"] as const;

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

export interface LiveWebLinkManifestItem extends BaseManifestItem {
  refreshSeconds: number;
  type: "live_web_link";
  url: string;
}

export type ManifestItem = MediaManifestItem | TextManifestItem | LiveWebLinkManifestItem;

export interface Manifest {
  id: string;
  items: ManifestItem[];
  name: string;
  version: number;
}
