# epi-info-client

Display client for Epi Info.

Use this repository to run one screen client. The client enrolls with the server once, stores its identity locally, downloads assigned content, and keeps displaying the last valid content when the server is unavailable.

## Requirements

- Docker and Docker Compose
- a running `epi-info-server`
- Chromium, for kiosk display on a screen device
- Git, for repository installs
- npm, only for local development without Docker

## Run From The Repository

Create the shared Docker network once:

```sh
docker network create epi-info-network
```

Clone or update the repository:

```sh
git clone <client-repository-url> epi-info-client
cd epi-info-client
```

If the repository is already cloned, update it instead:

```sh
git pull
```

Create a local `.env` file in this repository:

```sh
CLIENT_NAME=Lobby display
SERVER_BASE_URL=http://YOUR_SERVER_IP:4000
```

Start the client:

```sh
docker compose up -d --build
```

Open `http://localhost:3000` to see the connection code. In the server admin panel, open `Screens`,
choose `Add a screen`, enter the code, and approve the screen. The client stores its permanent
credential in the Docker volume automatically.

## Run From Docker Hub

Create a folder for the client deployment:

```sh
mkdir epi-info-client
cd epi-info-client
```

Pull the published image:

```sh
docker pull shortplanet/epi-info-client:1.0.1
```

Create `.env`:

```env
CLIENT_DATA_PATH=/data
CLIENT_DISPLAY_BIND_ADDRESS=127.0.0.1
CLIENT_DISPLAY_HOST=0.0.0.0
CLIENT_DISPLAY_PORT=3000
DISPLAY_DIST_PATH=/app/dist/display

SERVER_BASE_URL=http://YOUR_SERVER_IP:4000
CLIENT_NAME=Lobby display

CLIENT_SOFTWARE_VERSION=1.0.1
CLIENT_HEARTBEAT_INTERVAL_SECONDS=30
CLIENT_REQUEST_TIMEOUT_MS=10000
CLIENT_ASSET_DOWNLOAD_TIMEOUT_MS=300000
CLIENT_RETRY_MIN_SECONDS=5
CLIENT_RETRY_MAX_SECONDS=60
KIOSK_URL=http://localhost:3000
```

Start the client:

```sh
docker run -d \
  --name epi-info-client \
  --restart unless-stopped \
  --env-file .env \
  -p 127.0.0.1:3000:3000 \
  -v epi-info-client-data:/data \
  shortplanet/epi-info-client:1.0.1
```

Open the local display:

```text
http://localhost:3000
```

The display shows a short connection code on first startup. In the server admin panel, open
`Screens`, choose `Add a screen`, enter the code, and approve the screen.

The display port is bound to `127.0.0.1` by default. For remote debugging only, set `CLIENT_DISPLAY_BIND_ADDRESS=0.0.0.0` in `.env`.

The client identity is stored in the Docker volume and reused after restarts. A long
`CLIENT_ENROLLMENT_TOKEN` can still be supplied as an advanced recovery option, but it is not part of
normal installation.

The Docker service uses `restart: unless-stopped`, so after it has been started once it will come back after a reboot or container crash.

## Kiosk Startup

The Docker container serves the display, but Chromium runs on the device itself. On a Raspberry Pi or other screen device, install the host kiosk launcher:

Docker Hub-only installations can extract the launcher and service from the running container:

```sh
mkdir -p scripts systemd
docker cp epi-info-client:/app/support/scripts/start-kiosk.sh scripts/
docker cp epi-info-client:/app/support/systemd/epi-info-kiosk.service systemd/
```

Repository installations already contain these files. Install them on the host:

```sh
sudo install -m 0755 scripts/start-kiosk.sh /usr/local/bin/epi-info-kiosk
mkdir -p ~/.config/systemd/user
cp systemd/epi-info-kiosk.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now epi-info-kiosk.service
```

The kiosk service opens Chromium fullscreen at:

```text
http://localhost:3000
```

The service waits for the local display to answer, starts Chromium in kiosk mode, and restarts Chromium if it closes. The device must boot into a graphical session for Chromium to open automatically.

Useful kiosk commands:

```sh
systemctl --user restart epi-info-kiosk.service
systemctl --user status epi-info-kiosk.service
```

## Offline Behavior

The client stores its active manifest and downloaded assets locally. If the server is offline, the network fails, or the client restarts, it keeps displaying the last valid content.

New content is activated only after every required asset has downloaded and passed verification.

## Content Supported In 1.0.x

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
