# epi-info-client

Display client for Epi Info.

This repository will contain:

- a local Node.js agent;
- a React display app;
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

```sh
docker compose up --build
```

The local display endpoint listens on `http://localhost:3000`.
