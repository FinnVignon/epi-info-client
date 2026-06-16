import { useEffect } from "react";

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
    case "webpage":
      return (
        <iframe
          className="display-webpage"
          onLoad={onDisplayed}
          src={item.url}
          title="Epi Info web page item"
        />
      );
  }
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
