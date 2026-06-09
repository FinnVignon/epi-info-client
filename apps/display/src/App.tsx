import { useEffect, useMemo, useRef, useState } from "react";

import { Manifest, ManifestItem } from "../../shared/contracts";
import "./App.css";

function renderItem(item: ManifestItem) {
  switch (item.type) {
    case "image":
      return <img alt="" className={`display-media ${item.fit}`} src={item.localPath} />;
    case "video":
      return (
        <video
          autoPlay
          className={`display-media ${item.fit}`}
          loop
          muted
          playsInline
          src={item.localPath}
        />
      );
    case "text":
      return (
        <div className="display-text">
          <p>{item.text}</p>
        </div>
      );
    case "webpage":
      return <iframe className="display-webpage" src={item.url} title="Epi Info web page item" />;
  }
}

export function App() {
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [error, setError] = useState(false);
  const hasManifest = useRef(false);
  const manifestKey = manifest ? `${manifest.id}:${manifest.version}` : "none";
  const activeItem = useMemo(
    () => manifest?.items[activeItemIndex % Math.max(1, manifest.items.length)] ?? null,
    [activeItemIndex, manifest],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadManifest() {
      try {
        const response = await fetch("/api/manifest", { cache: "no-store" });
        const body = (await response.json()) as Manifest;

        if (!cancelled) {
          hasManifest.current = true;
          setManifest((currentManifest) =>
            currentManifest?.id === body.id && currentManifest.version === body.version
              ? currentManifest
              : body,
          );
          setError(false);
        }
      } catch {
        if (!cancelled && !hasManifest.current) {
          setError(true);
        }
      }
    }

    void loadManifest();
    const interval = window.setInterval(() => void loadManifest(), 2000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    setActiveItemIndex(0);
  }, [manifestKey]);

  useEffect(() => {
    if (!manifest || manifest.items.length <= 1 || !activeItem) {
      return;
    }

    const timeout = window.setTimeout(
      () => {
        setActiveItemIndex((currentIndex) => (currentIndex + 1) % manifest.items.length);
      },
      Math.max(1, activeItem.durationSeconds) * 1000,
    );

    return () => window.clearTimeout(timeout);
  }, [activeItem, manifest]);

  if (error) {
    return (
      <main className="display-shell">
        <span className="display-state">No local manifest available</span>
      </main>
    );
  }

  if (!activeItem) {
    return (
      <main className="display-shell">
        <span className="display-state">Loading display</span>
      </main>
    );
  }

  return <main className="display-shell">{renderItem(activeItem)}</main>;
}
