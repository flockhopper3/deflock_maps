# Local testing — per-country camera datasets

Everything below runs against a **local** miniflare R2 (`.wrangler/state/v3/r2/flockhopper-data`).
Production R2 is never touched until `npm run deploy`.

## 1. Unit tests (offline)

```bash
cd worker && npm test && npm run typecheck
```
All `subtractForeign`, `buildDataset`, and pipeline-guard tests must pass.

## 2. Scoped border run (fast, real Overpass, local R2)

Start the local Worker (this sets `ENVIRONMENT=development`, enabling the `bbox` param):

```bash
cd worker && npm run dev
```

In another terminal, trigger a Detroit–Windsor run. The `bbox` scopes only the US tiling;
the full Canada + Mexico area queries still run, so the Windsor (Canadian) cameras in the
box get subtracted. `force=true` lets the small scoped result write locally. Use the local
trigger secret (from `.dev.vars` / `wrangler secret`):

```bash
curl -s -X POST "http://localhost:8787/trigger?bbox=42.0,-83.3,42.5,-82.9&force=true" \
  -H "Authorization: Bearer $TRIGGER_SECRET" | jq
```

Expected JSON: `fetchers` contains `cameras:US` and `cameras:CA`, both `success: true`.
`cameras:CA` count ≈ 512 (full Canada). `cameras:US` = the Detroit-side cameras only.

## 3. Inspect the split output

```bash
curl -s "http://localhost:8787/cameras.geojson.gz"    | jq '.features | length'   # US (Detroit side)
curl -s "http://localhost:8787/cameras-ca.geojson.gz" | jq '.features | length'   # CA (~512)
```

Paste `cameras.geojson.gz` into geojson.io: no dots should sit on the Windsor (south/east)
side of the Detroit River. If any do, the subtraction missed them — check that the Canada
area query returned ~512 and that keys are compared as `${type}/${id}`.

## 4. Optional full local dry run (slow)

With `npm run dev` still running, trigger a full national pass into local R2:

```bash
curl -s -X POST "http://localhost:8787/trigger?force=true" \
  -H "Authorization: Bearer $TRIGGER_SECRET" | jq
```

Expect `cameras:US` in the tens of thousands and `cameras:CA` ≈ 512. Confirm a known
Toronto camera is present in `cameras-ca.geojson.gz` and absent from `cameras.geojson.gz`.
This can take a few minutes (full US tiling).

## Do not deploy until steps 1–3 pass.
