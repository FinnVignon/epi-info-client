# epi-info-client

Display client for Epi Info.

This repository contains:

- a local Node.js agent;
- a React display app;
- one-time enrollment with the Epi Info server;
- persistent client identity and authenticated heartbeats;
- persistent local caching for manifests and assets;
- Docker runtime support for screen devices;
- Chromium kiosk integration guidance.

## Development

```sh
npm install
npm run dev
```

Run the display UI in another terminal:

```sh
npm run dev:display
```

## Docker

Generate a client enrollment token from the server admin Clients screen. Put it in
the client repository's local `.env` file together with a recognizable display
name:

```sh
CLIENT_NAME=Lobby display
CLIENT_ENROLLMENT_TOKEN=the-single-use-token
```

Then start the client:

```sh
docker network create epi-info-network
docker compose up --build
```

The local display endpoint listens on `http://localhost:3000`.
The network creation command is only needed once. Both the server and client
Compose stacks join `epi-info-network`, and the client reaches the API through
the stable `http://epi-info-server:4000` container hostname.

The client stores its identity in the `client-data` Docker volume. After the
first successful enrollment, remove `CLIENT_ENROLLMENT_TOKEN` from `.env`; the
stored identity is reused across container restarts.

The local display starts before server enrollment or heartbeat attempts. If the
server is unavailable, the display remains available and the agent retries with
bounded exponential backoff.

Manifest media is downloaded to a temporary file, checked against its expected
SHA-256 hash, and only then made available to the display. The previous active
manifest remains unchanged if synchronization fails. Large media downloads use
`CLIENT_ASSET_DOWNLOAD_TIMEOUT_MS`, which defaults to five minutes.

## Local Agent API

- `GET /api/health` reports local display and server-connection status without
  exposing the client secret.
- `GET /api/manifest` returns the active local manifest.

## Planned Sync Notifications

Add a temporary on-screen notification driven by local agent state:

- show progress only while a manifest or asset is downloading or being verified;
- show activation success or synchronization failure for a few seconds;
- keep cached content playing behind the notification;
- include safe setup details such as manifest version, progress, and an error
  summary without credentials;
- show nothing while the client is idle and up to date.
