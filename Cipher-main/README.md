# ShadowGraph KZ

ShadowGraph KZ is a full-stack MVP for authorized OSINT and risk intelligence workflows in Kazakhstan. It ingests analyst-configured public sources, stores provenance, extracts entities, scores risk transparently, builds graph relationships, maps city-level signals, and generates analyst reports.

## Legal Boundaries

- Only collect legally accessible public sources or analyst-provided authorized sources.
- Telegram collection is limited to public channels/chats explicitly configured by an analyst.
- Onion/DarkNet collection has no preloaded targets and only supports analyst-provided open URLs when `TOR_PROXY_URL` is configured.
- No hacking, login bypass, credential theft, CAPTCHA bypass, private group scraping, seller interaction, illegal purchasing, or harmful file downloading is implemented.
- Automated indicators require human verification and are not assertions of criminal activity.
- Sensitive values are redacted in the UI by default.

## Stack

- `apps/web`: Next.js App Router, TypeScript, Tailwind, shadcn-style components, Recharts, React Flow
- `apps/api`: FastAPI, SQLAlchemy, SQLite by default, Postgres via `DATABASE_URL`
- `docker-compose.yml`: frontend, API, Postgres, Redis, Neo4j service targets

## Quick Start

```bash
cd darktrace-kz
cp .env.example .env
npm install
python -m venv apps/api/.venv
apps/api/.venv/bin/pip install -r apps/api/requirements.txt
```

Start the API:

```bash
cd apps/api
.venv/bin/uvicorn app.main:app --reload
```

Start the frontend:

```bash
npm run dev:web
```

Open:

- Web app: http://localhost:3000
- API docs: http://localhost:8000/docs

## Docker

```bash
cp .env.example .env
docker compose up --build
```

Docker overrides `DATABASE_URL` to Postgres. Local non-Docker development uses SQLite by default.

## Real Data Mode

`DEMO_MODE=false` by default. With no sources configured, the app displays empty states and integration setup messages. No fake Telegram posts, wallets, darknet findings, locations, or cases are shown as real data.

Use the Sources page to:

- Add a public web URL.
- Add a public Telegram channel identifier for future Telethon-backed sync.
- Add public RSS/feed, blockchain wallet, or analyst-provided onion source records.
- Paste manual public text for immediate ingestion.
- Run collection for configured public web sources.

Each ingested item stores:

- `source_id`
- `source_url`
- `captured_at`
- `content_hash`
- redacted raw text excerpt
- extracted entities and extraction method
- explainable risk score and reasons
- evidence record with SHA-256 hash

## Explicit Demo Mode

The Sources page includes an `Explicit demo sample` button. It creates one clearly labeled `demo://` sample item for presentation testing. It is not used automatically and is not presented as real evidence.

## Integrations

Configure these in `.env`:

```bash
SEARCH_API_PROVIDER=
SEARCH_API_KEY=
SEARCH_ENGINE_ID=
TELEGRAM_API_ID=
TELEGRAM_API_HASH=
TELEGRAM_SESSION_NAME=
TOR_PROXY_URL=socks5h://127.0.0.1:9050
ETHERSCAN_API_KEY=
TRONSCAN_API_KEY=
BLOCKCHAIN_PROVIDER=
OPENAI_API_KEY=
MAPBOX_TOKEN=
NEXT_PUBLIC_MAPBOX_TOKEN=
```

If credentials are missing, `/settings/integrations` returns setup states such as “Telegram integration not configured” instead of fake results.

## API Highlights

- `GET/POST /api/sources`
- `PATCH/DELETE /api/sources/{id}`
- `POST /api/sources/{id}/test`
- `POST /api/sources/{id}/run`
- `POST /api/jobs/run-all`
- `GET /api/items`
- `POST /api/items/manual`
- `POST /api/items/{id}/mark-reviewed`
- `GET /api/entities`
- `GET /api/entities/{id}/connections`
- `GET /api/entities/{id}/related`
- `GET /api/graph`
- `POST /api/graph/rebuild`
- `POST /api/graph/case-from-cluster`
- `GET /api/graph/cluster/top-risk`
- `GET /api/map/signals`
- `GET /api/cases`
- `POST /api/cases`
- `GET /api/alerts`
- `POST /api/alerts/{id}/read`
- `POST /api/reports/generate`
- `GET /api/settings/integrations`

## Verification

```bash
cd apps/api
.venv/bin/pytest

cd ../..
npm run typecheck:web
npm run build:web
```
