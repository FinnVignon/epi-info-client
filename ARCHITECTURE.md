# Client Architecture

The client is a local, offline-first display appliance. Its Node agent owns server communication,
identity, verification, caching, and the local HTTP API. Chromium only renders the React display
served by that agent.

## Runtime Components

- `apps/agent/src/index.ts` composes the process and shutdown sequence.
- `apps/agent/src/connection/` owns enrollment, heartbeat polling, WebSocket signals, server HTTP
  transport, response validation, synchronization, and user-visible sync notifications.
- `apps/agent/src/storage/` owns the durable identity, active manifest, and asset cache.
- `apps/agent/src/manifest/` validates every manifest before use.
- `apps/agent/src/http/` serves the local display, status endpoints, and cached files.
- `apps/display/src/` is the React kiosk UI. It only talks to the local agent.
- `apps/shared/` contains protocol and local-display contracts.
- `scripts/` and `systemd/` start Chromium on the host after the containerized display is ready.

## Offline Activation Flow

At startup, the local server immediately exposes the last active manifest. The connection agent
then enrolls or authenticates and asks the controller for the effective assignment. WebSockets only
request an immediate sync; regular heartbeats remain the fallback when a socket or server is down.

For media content, the synchronizer downloads every required asset to a temporary path, verifies
its SHA-256 hash, and atomically activates the manifest only when all files are valid. A failed sync
leaves the previous manifest and assets active. Once Chromium confirms the new manifest is visible,
assets outside that manifest are deleted from the local cache.

Live web links do not provide offline page content because their remote page is not cached. The
client still retains the assignment itself and retries normal connectivity.

## Security Boundaries

The enrollment token is used only to create a client identity. The durable client secret is written
atomically with owner-only permissions and sent only to the configured server origin. Manifest
asset downloads must use the same origin and the authenticated client asset endpoint. Local cached
paths reject traversal. Live pages run in a sandboxed iframe without referrer information.

Bind the display endpoint to loopback unless remote diagnostics are required. Use HTTPS for the
server whenever traffic crosses an untrusted network.

## Change Rules

Keep transport, protocol validation, synchronization, persistence, and presentation in separate
modules. Preserve the invariant that an unverified manifest can never replace active content. Any
server protocol change must update contracts and compatibility tests in both repositories.
