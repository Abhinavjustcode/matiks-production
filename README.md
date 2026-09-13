# MATIKS Production Architecture v0.1

This is the production-oriented next foundation for MATIKS.

## Core rule

**Gemini does not decide live matchmaking.**

The live path must be deterministic, low-latency and cheap:

Player telemetry → MATIKS Brain → skill/edge → Redis queue → matchmaker → game server.

Gemini is used asynchronously for:
- generating large question banks
- question review / repair
- explanations
- topic classification
- difficulty calibration suggestions
- post-match coaching
- anomaly/quality analysis

Google's current Gemini API docs list `gemini-3.8-flash` as the stable Flash model and document structured JSON output. The API key must remain server-side in `GEMINI_API_KEY`.

## 1,000+ question pipeline

`npm run questions:generate`

Queues 40 Gemini jobs × 25 questions = **1,000 questions**.

Production ingestion should:
1. Generate.
2. Zod validate schema.
3. Deterministically lint code.
4. Compile/run code in a sandbox.
5. Verify expected output.
6. Run duplicate/similarity checks.
7. Assign quality score.
8. Only then set `active=true`.

Do not put generated questions directly into live matchmaking.

## Brain

The Brain tracks:
- currentEdge
- level
- accuracy EMA
- speed EMA
- consistency
- volatility
- confidence
- topic scores
- recent results

It intentionally avoids LLM calls during a duel.

## Matchmaking

Start:
`POST /matchmaking/join`

Pair:
`POST /matchmaking/pair`

The initial implementation uses Redis sorted-set storage by currentEdge. For high-scale production, shard queues by region/game mode and use a dedicated matchmaking worker.

## Run locally

```bash
cp .env.example .env
docker compose up -d
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Frontend:
http://localhost:5173

API:
http://localhost:4000

## Gemini

Install/configuration follows Google's official Gemini API guidance:
- `@google/genai`
- `GEMINI_API_KEY`
- structured JSON response
- `gemini-3.8-flash`

Never expose `GEMINI_API_KEY` to React.

## Production hardening still required

Before public launch:
- real authentication + refresh-token rotation
- PostgreSQL connection pooling
- Redis cluster
- dedicated WebSocket game service
- sandboxed compiler/judge workers
- per-match authoritative timers
- idempotency keys for answer submissions
- anti-cheat telemetry
- question versioning + audit trail
- moderation/admin console
- OpenTelemetry + metrics
- backups and disaster recovery
- CI/CD + migrations
- secrets manager
- regional matchmaking
- load testing
- WAF/CDN
