import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Manifest } from "../../shared/contracts";
import type { SyncNotificationSnapshot } from "../../shared/localDisplayContracts";
import {
  LOCAL_FALLBACK_MANIFEST_ID,
  type LocalClientPairingSnapshot,
} from "../../shared/localPairingContracts";
import {
  acknowledgeDisplayedManifest as sendDisplayedManifestAcknowledgement,
  loadActiveManifest,
  loadClientPairing,
  loadSyncNotification,
} from "./api/localAgentApi";
import { DisplayItem } from "./components/DisplayItem";
import { ClientPairingView } from "./components/ClientPairingView";
import { SyncNotificationOverlay } from "./components/SyncNotificationOverlay";
import "./App.css";

export function App() {
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [notification, setNotification] = useState<SyncNotificationSnapshot | null>(null);
  const [pairing, setPairing] = useState<LocalClientPairingSnapshot | null>(null);
  const [error, setError] = useState(false);
  const acknowledgedManifestKey = useRef<string | null>(null);
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
        const body = await loadActiveManifest();

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
    let cancelled = false;

    async function refreshPairing() {
      try {
        const nextPairing = await loadClientPairing();

        if (!cancelled) {
          setPairing(nextPairing);
        }
      } catch {
        // Existing content remains visible if the local status endpoint is temporarily unavailable.
      }
    }

    void refreshPairing();
    const interval = window.setInterval(() => void refreshPairing(), 1000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function refreshNotification() {
      try {
        const nextNotification = await loadSyncNotification();

        if (!cancelled) {
          setNotification(nextNotification);
        }
      } catch {
        if (!cancelled) {
          setNotification(null);
        }
      }
    }

    void refreshNotification();
    const interval = window.setInterval(() => void refreshNotification(), 250);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    setActiveItemIndex(0);
  }, [manifestKey]);

  const acknowledgeDisplayedManifest = useCallback(async (): Promise<void> => {
    if (!manifest || acknowledgedManifestKey.current === manifestKey) {
      return;
    }

    try {
      if (await sendDisplayedManifestAcknowledgement(manifest)) {
        acknowledgedManifestKey.current = manifestKey;
      }
    } catch {
      // The display keeps retrying through normal media load events and manifest polling.
    }
  }, [manifest, manifestKey]);

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

  function renderDisplayContent() {
    if (error) {
      return <span className="display-state">No local manifest available</span>;
    }

    if (!activeItem) {
      return <span className="display-state">Loading display</span>;
    }

    return (
      <DisplayItem
        key={`${manifestKey}:${activeItem.id}`}
        item={activeItem}
        onDisplayed={() => void acknowledgeDisplayedManifest()}
      />
    );
  }

  const isPairing = pairing && pairing.state !== "idle";
  const hasAssignedContent = manifest !== null && manifest.id !== LOCAL_FALLBACK_MANIFEST_ID;

  if (isPairing && !hasAssignedContent) {
    return (
      <main className="display-shell">
        <ClientPairingView pairing={pairing} />
      </main>
    );
  }

  return (
    <main className="display-shell">
      {renderDisplayContent()}
      {isPairing ? <ClientPairingView compact pairing={pairing} /> : null}
      <SyncNotificationOverlay notification={notification} />
    </main>
  );
}
