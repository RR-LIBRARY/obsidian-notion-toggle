# Audit report — Notion Toggle 1.7.0 (Web research)

Date: 2026-09-24 · Scope: the Obsidian plugin (this repo) and the Toggle Research bridge web app whose source snapshot lives in `backup/`.

## 1. Verdict

**Release-ready.** Every automated check is green, and the plugin's real bridge client was exercised end to end against a running bridge with a freshly minted key. No open defects.

| Check | Result |
| --- | --- |
| Plugin unit + wiring tests (`bun test`) | **1037 pass / 0 fail**, 4240 assertions, 66 files |
| Plugin typecheck (`tsc --noEmit`) | clean |
| Plugin build (`esbuild` + `build-dist.mjs`) | `main.js` 421,223 bytes, `dist/` (main.js, manifest.json, styles.css, index.html) |
| Architecture guard (`tests/research-architecture.test.ts`) | `main.ts` reaches `src/research/*` only through `wire.ts` (type-only imports allowed) |
| Bridge health `GET /api/public/research/health` | `parallel: true, perplexity: true, ai: true` |
| Bridge end-to-end (dashboard key → plugin client → providers) | pass — see section 3 |

## 2. What was audited

### Plugin (this repo)
- `src/research/` — `client.ts`, `transport.ts`, `cache.ts`, `format.ts`, `service.ts`, `runs.ts`, `panel.ts`, `modals.ts`, `commands.ts`, `settings.ts`, `dom.ts`, `types.ts`, `wire.ts`.
- `main.ts` orchestration (research is wired through `src/research/wire.ts` only).
- `styles.css` — `.ntt-research-panel` / `.ntt-rp-*` classes, prompt dialogs, notice action buttons.
- `tests/research-*.test.ts` — format, client, runs, service, panel, settings, wire, architecture.

### Bridge web app (`backup/`)
- Public API: `src/routes/api/public/research/{health,search,perplexity,extract,answer,factcheck,recall,tasks}`.
- Server core: `src/lib/research/{auth,cache,core,errors,gateway,http,parallel,perplexity}.server.ts`, `schemas.ts` (zod).
- Dashboard: `src/routes/_authenticated/dashboard.tsx` (Keys, Usage, Playground, Deep research), `src/routes/auth.tsx`, `src/routes/docs.tsx`.
- Database: `drizzle/migrations/0000_research_bridge_tables.sql`, `0001_touch_plugin_key_fn.sql`.

## 3. End-to-end verification (2026-09-24)

Performed against a local bridge with live Parallel and Perplexity connections:

1. Signed up a throwaway account on `/auth`; reserved domains (example.com) are correctly refused by the auth service.
2. Created key **"E2E vault"** on *Dashboard → Keys*. Plaintext (`ntr_…`, 47 chars) shown once; list shows only the 12-char prefix.
3. `GET /health` with the key → `key: { name: "E2E vault", prefix: "ntr_nSaq4aLW" }`; without a key → `key: null`.
4. `POST /perplexity` `{query, maxResults: 3}` → 200, 3 results with titles/URLs, 2.6 s.
5. `POST /search` (Parallel, `mode: "fast"`) → 200, 3 results, `warnings: []`, 1.5 s; the same request again → `cached: true`, ~1 ms.
6. Invalid key → **401** `unauthorized`; empty query → **400** `invalid_request` with the zod message.
7. The plugin's own `ResearchClient` (the code shipped in `main.js`) was run with a real fetch transport against the same bridge: health, perplexity, cached search, typed `unauthorized` and `invalid_request` errors — 5/5 pass.
8. *Dashboard → Usage* reflected all of the above: 5 requests, 60 % served from cache, 0 errors, per-operation breakdown and the recent-requests table.

## 4. Security review

- **Keys**: 32 random bytes, base64url, `ntr_` prefix. Only the SHA-256 hash is stored; the prefix is kept for display. Plaintext is returned once from `createPluginKey` and never logged.
- **Auth on the public API**: every research endpoint resolves the caller through `resolveCaller` (Bearer / `X-Plugin-Key`), rejects malformed, unknown and revoked keys with 401, and runs provider calls under that user's identity.
- **Row-level security**: `plugin_keys` (select/insert/update/delete own), `research_requests` and `research_runs` (select own), `research_cache` (service role only). Explicit `GRANT`s accompany every table.
- **Privileged client**: `supabaseAdmin` is loaded lazily inside server handlers only (`client.server.ts`), never in client bundles; dashboard server functions use the caller's RLS-scoped client.
- **Provider credentials**: `LOVABLE_API_KEY`, `PARALLEL_API_KEY`, `PERPLEXITY_API_KEY` are read from `process.env` inside handlers; all provider traffic goes through the connector gateway; nothing provider-related reaches the browser or the plugin.
- **Input validation**: zod schemas on every endpoint (query length ≤ 300, result caps, URL validation on extract, ≤ 10 concurrent deep-research runs per user → 429 `rate_limited`).
- **Error surfacing**: provider status + body are relayed with machine-readable codes (`upstream_error`, `rate_limited`, `payment_required`, …); the plugin maps them to reader-facing messages.
- **Plugin side**: the key is masked in Settings with a reveal button and a shape check (`^ntr_[A-Za-z0-9_-]{16,}$`); network access goes through Obsidian's `requestUrl` (mobile-safe, CORS-free) with a `fetch` fallback; the on-device cache is bounded and TTL-limited (15 min).
- **Backup**: `backup/` contains source only — no `.env`, no generated clients, no keys (verified by scanning for `sb_secret_`, `SERVICE_ROLE`, `lovc_`, `pplx-`, `ntr_` values).

## 5. Fixes made during this audit

- Architecture guardrail now permits type-only imports from `src/research/*` in `main.ts`.
- Panel test double echoes the polled run id, matching the real service contract.
- Settings tests drive the real Obsidian controls (`.checkbox-container` for toggles, `input` events for sliders) and use the real search mode set (`turbo | fast | basic | advanced`).
- `styles.css` gained the missing `.ntt-rp-runs` / `.ntt-rp-results` rules the panel already referenced.

## 6. Known limitations / follow-ups

- The bridge must be published from Lovable to obtain a public URL; the plugin README instructs readers to paste their own bridge URL.
- Email sign-up requires confirmation (no auto-confirm); Google sign-in is configured.
- Deep-research runs poll from the plugin while Obsidian is open; there is no server-side scheduler yet (see ROADMAP).
- No per-key daily budget yet — the 10-concurrent-runs cap and provider rate limits are the only quotas.

## 7. Release checklist

- [x] `manifest.json`, `package.json`, `versions.json` → 1.7.0 (minAppVersion unchanged)
- [x] `main.js`, `styles.css`, `manifest.json` rebuilt from source and committed
- [x] README / MANUAL §15 / FEATURES / FEATURE-STATUS / CHANGELOG updated
- [x] `backup/` refreshed from the bridge project
- [x] Tag `1.7.0` (no `v` prefix — BRAT matches `manifest.version`) + GitHub release with the three BRAT assets (`.github/workflows/release-assets.yml`)
