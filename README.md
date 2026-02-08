# Last-Mile Delivery Price Aggregator & Automation Engine

A Windows-VM–hosted system that orchestrates parallel OpenClaw browser agents to fetch real-time delivery quotes from Singapore-based last-mile providers.

## Partners

| Partner | Status |
|---|---|
| GrabExpress | Adapter ready |
| Deliveroo SG | Adapter ready |
| Foodpanda SG | Adapter ready |
| uParcel | Adapter ready |
| EasyParcel SG | Adapter ready |
| Lalamove | Adapter ready |

## Quick Start

### 1. Provision Azure VM

```powershell
# From your local machine (requires Azure CLI)
.\infra\azure\provision-vm.ps1 -AdminUsername azureadmin
```

### 2. Setup on the VM

RDP into the VM, then:

```powershell
git clone https://github.com/AkhileshMishra/delivery-aggregator.git C:\delivery-aggregator
cd C:\delivery-aggregator
.\infra\windows\install.ps1
```

### 3. Authenticate Partners

For each partner, trigger re-auth (opens a visible browser for manual login):

```bash
curl -X POST http://localhost:3000/v1/reauth/lalamove
curl -X POST http://localhost:3000/v1/reauth/grabexpress
# ... repeat for each partner
```

### 4. Get Quotes

```bash
curl -X POST http://localhost:3000/v1/quotes \
  -H "Content-Type: application/json" \
  -d '{
    "source_location": { "address": "1 Raffles Place, Singapore", "lat": 1.2847, "lng": 103.8518 },
    "destination_location": { "address": "Changi Airport T3, Singapore", "lat": 1.3574, "lng": 103.9876 },
    "preferred_pickup_time": "2026-02-08T07:30:00+08:00"
  }'
```

### 5. Monitor Health

```bash
curl http://localhost:3000/v1/health
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/v1/quotes` | Fetch delivery quotes from all partners |
| `GET` | `/v1/health` | Per-partner session health status |
| `POST` | `/v1/reauth/:partnerId` | Trigger re-authentication for a partner |

## Architecture

See [docs/architecture.md](docs/architecture.md) for the full design.

Key decisions:
- **No Redis** — in-process `p-queue` + `Promise.allSettled` (single VM)
- **Cookie store, not browser profiles** — AES-256-GCM encrypted, version-independent
- **Luxon for timezone handling** — all internal timestamps UTC, SGT at API boundary
- **Circuit breaker per partner** — 3-state (closed → open → half-open)
- **Dedup cache** — 30s TTL, success-only (partial failures never cached)
- **Health probes** — background interval with concurrency cap of 2

## Configuration

All via environment variables (or `.env` file):

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | API server port |
| `MAX_BROWSER_CONCURRENCY` | `6` | Max parallel browser contexts for quotes |
| `DEFAULT_PICKUP_OFFSET_MINUTES` | `60` | Fallback pickup time offset |
| `SESSION_ENCRYPTION_KEY` | — | **Required.** 64-char hex key for cookie encryption |
| `SESSION_DIR` | `./storage/sessions` | Encrypted cookie storage path |
| `ARTIFACTS_DIR` | `./storage/artifacts` | Debug packet storage path |
| `HEALTH_PROBE_INTERVAL_MS` | `300000` | Health probe interval (5 min) |
| `HEALTH_PROBE_CONCURRENCY` | `2` | Max parallel health probes |
| `LOG_LEVEL` | `info` | Pino log level |
| `API_KEY` | — | Optional API key for auth |

## Development

```bash
npm install
npm run dev    # watch mode with tsx
npm run build  # compile TypeScript
npm test       # run tests
```

## License

MIT
