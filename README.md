# epi-info-client

Display client for Epi Info.

Use this repository to run one screen client. The client enrolls with the server once, stores its identity locally, downloads assigned content, and keeps displaying the last valid content when the server is unavailable.

## Requirements

- Docker and Docker Compose
- a running `epi-info-server`
- npm, only for local development without Docker

## Start With Docker

Create the shared Docker network once:

```sh
docker network create epi-info-network
```

Generate an enrollment token from the server admin panel, then create a local `.env` file in this repository:

```sh
CLIENT_NAME=Lobby display
CLIENT_ENROLLMENT_TOKEN=the-single-use-token
```

Start the client:

```sh
docker compose up --build
```

Open the local display:

```text
http://localhost:3000
```

After the first successful enrollment, remove `CLIENT_ENROLLMENT_TOKEN` from `.env`. The client identity is stored in the Docker volume and reused after restarts.

## Offline Behavior

The client stores its active manifest and downloaded assets locally. If the server is offline, the network fails, or the client restarts, it keeps displaying the last valid content.

New content is activated only after every required asset has downloaded and passed verification.

## Content Supported In 1.0

- uploaded images;
- uploaded videos;
- live web links with a refresh interval.

Text content and playlists are planned after 1.0.

## Useful Commands

Install dependencies:

```sh
npm install
```

Run the agent locally:

```sh
npm run dev
```

Run the display UI locally:

```sh
npm run dev:display
```

Run checks:

```sh
npm run lint
npm test
npm audit --audit-level=low
```

Check local client status:

```text
http://localhost:3000/api/health
```

Stop Docker containers:

```sh
docker compose down
```

To reset local client identity and cached content, remove the Docker volume intentionally.
