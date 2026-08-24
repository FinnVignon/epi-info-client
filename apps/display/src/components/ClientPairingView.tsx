import type { LocalClientPairingSnapshot } from "../../../shared/localPairingContracts";

interface ClientPairingViewProps {
  compact?: boolean;
  pairing: LocalClientPairingSnapshot;
}

export function ClientPairingView({ compact = false, pairing }: ClientPairingViewProps) {
  const content = getPairingContent(pairing);

  return (
    <aside className={compact ? "pairing-overlay" : "pairing-screen"} role="status">
      <div className="pairing-brand">Epi Info</div>
      <h1>{content.title}</h1>
      {pairing.userCode ? <strong className="pairing-code">{pairing.userCode}</strong> : null}
      <p>{content.message}</p>
      {pairing.lastError ? <small>{pairing.lastError}</small> : null}
    </aside>
  );
}

function getPairingContent(pairing: LocalClientPairingSnapshot): {
  message: string;
  title: string;
} {
  switch (pairing.state) {
    case "pending":
      return {
        message: "Open Screens in the server panel and enter this code.",
        title: "Connect this screen",
      };
    case "rejected":
      return {
        message: "This request was not approved. A new code will appear automatically.",
        title: "Connection rejected",
      };
    case "error":
      return {
        message: pairing.userCode
          ? "The code remains valid while the client reconnects."
          : "The client will retry automatically.",
        title: "Cannot reach the server",
      };
    default:
      return {
        message: "The client is requesting a secure connection code.",
        title: "Connecting to server",
      };
  }
}
