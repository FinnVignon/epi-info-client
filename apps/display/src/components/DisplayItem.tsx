import { useEffect, useState } from "react";

import type { ManifestItem } from "../../../shared/contracts";

interface DisplayItemProps {
  item: ManifestItem;
  onDisplayed: () => void;
}

export function DisplayItem({ item, onDisplayed }: DisplayItemProps) {
  switch (item.type) {
    case "image":
      return (
        <img
          alt=""
          className={`display-media ${item.fit}`}
          onLoad={onDisplayed}
          src={item.localPath}
        />
      );
    case "video":
      return (
        <video
          autoPlay
          className={`display-media ${item.fit}`}
          loop
          muted
          onCanPlay={onDisplayed}
          playsInline
          src={item.localPath}
        />
      );
    case "text":
      return <TextDisplayItem onDisplayed={onDisplayed} text={item.text} />;
    case "live_web_link":
      return (
        <LiveWebLinkDisplayItem
          onDisplayed={onDisplayed}
          refreshSeconds={item.refreshSeconds}
          url={item.url}
        />
      );
  }
}

function LiveWebLinkDisplayItem({
  onDisplayed,
  refreshSeconds,
  url,
}: {
  onDisplayed: () => void;
  refreshSeconds: number;
  url: string;
}) {
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setRefreshKey(0);
  }, [url, refreshSeconds]);

  useEffect(() => {
    const interval = window.setInterval(
      () => setRefreshKey((currentKey) => currentKey + 1),
      Math.max(1, refreshSeconds) * 1000,
    );

    return () => window.clearInterval(interval);
  }, [refreshSeconds]);

  return (
    <iframe
      key={`${url}:${refreshKey}`}
      className="display-live-web-link"
      onLoad={onDisplayed}
      referrerPolicy="no-referrer"
      sandbox="allow-forms allow-same-origin allow-scripts"
      src={url}
      title="Epi Info live web link item"
    />
  );
}

function TextDisplayItem({ onDisplayed, text }: { onDisplayed: () => void; text: string }) {
  useEffect(() => {
    onDisplayed();
  }, [onDisplayed]);

  return (
    <div className="display-text">
      <p>{text}</p>
    </div>
  );
}
