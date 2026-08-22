# Contributing

Development is integrated through the `DEV` branch. Create a focused branch from the current
`DEV`, keep unrelated changes out, and open a review before merging.

Use short commit subjects with the established prefixes:

- `[ADD]` for a new capability;
- `[FIX]` for a defect or security repair;
- `[UPDATE]` for a behavior, dependency, or organization change;
- `[DOCS]` for documentation only.

Before every potential push, run:

```sh
npm ci
npm run format:check
npm run lint
npm test
npm run build
npm audit --audit-level=low
docker build -t epi-info-client:local .
```

For changes involving enrollment, synchronization, caching, playback, or live updates, also test
against a real server stack. Verify a fresh enrollment, individual/group/global assignments, a
client restart, a server outage, a failed or corrupted download, and recovery.

Keep modules purpose-specific. Connection transport, response parsing, synchronization, storage,
local HTTP, and React presentation are separate boundaries. Do not let WebSockets become required
for correctness; heartbeat polling and cached content must continue to work independently.

Do not commit `.env`, the client identity, cached manifests/assets, generated `dist/` output, or
real enrollment tokens.
