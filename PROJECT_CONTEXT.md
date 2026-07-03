# Project Context

## Objective

Build an independent GEO project and knowledge base that stores all currently provided GEO materials in a form ChatGPT can read, analyze, and reuse.

The project should support two practical outcomes:

1. Systematic GEO learning and source-backed research.
2. A future lightweight GEO diagnosis/content-engineering agent that can generate client-ready reports.

## Current Scope

This project started as a local knowledge project and now also contains a first H5 MVP app under `apps/ai-exposure-check-h5`.

It contains:

- Source snapshots from X/Twitter, doc pages, GitHub resources, and local fridge-radar artifacts.
- Synthesized method notes.
- Product roadmap and templates for future agent work.
- A mobile-first H5 AI exposure diagnosis product for lead capture and DeepSeek-sampled GEO reports.

## Current Constraints

- No database.
- No login system.
- No payment.
- No Docker.
- No production deployment automation.
- No hidden browser cookies or login-state scraping.
- No fabricated citation/data/media.
- The H5 MVP stores local runtime JSON only and must not expose model API keys to the browser.

## Main Insight

The collected materials point to a layered GEO system:

1. GEO as answer/citation/absorption visibility, not just classic ranking.
2. GEO content engineering as a system of Prompt Universe, evidence atoms, structured content, authority networks, measurement, and governance.
3. A sellable first product should be diagnosis and reporting, not a heavy content factory.
4. GEOFlow is useful as a reference for later content production/distribution, but is too heavy as the first build.

## Project Status

Initial source snapshot and project skeleton created on 2026-06-28.

H5 MVP implementation started on 2026-06-30:

- Location: `apps/ai-exposure-check-h5`
- Frontend: React + Vite + TypeScript + Tencent TDesign Mobile React.
- Backend: Node.js + Express + TypeScript.
- Model adapter: DeepSeek OpenAI-compatible API, default model `deepseek-v4-pro`.
- Report mode: DeepSeek `deepseek-v4-pro` real question sampling first, then transparent rule scoring into one `GEO 分析成果得分`.
- Runtime storage: local `runtime/diagnoses/*.json`, `runtime/evidence/<reportId>/`, and `runtime/submissions.jsonl`, ignored by Git.

2026-06-30 closeout status:

- The H5 app compiles with `npm run typecheck` and `npm run build`.
- Local DeepSeek configuration was copied from OpenClaw into ignored `.env.local`; the secret value is not documented in project files.
- The server now loads `.env.local` before `.env`, so local DeepSeek settings work without exposing keys to the browser.
- Local production service was restarted in a detached `screen` session named `ai-exposure-h5` and responds at `http://127.0.0.1:8787`.
- Health check returns `model: deepseek-v4-pro`.
- The first real DeepSeek-enabled sample diagnosis has been run with `冰箱小雷达`.
- Sample report output is stored at `outputs/h5-mvp/fridge-radar-sample/`, including `input.json`, `api-response.json`, `sample-report.md`, `evidence-notes.md`, `online-smoke.json`, and local/online screenshots.
- H5 UI now shows report ID, evidence labels, evidence boundary notes, privacy/user agreement links,备案占位, and clearer add-WeChat / appointment CTAs.
- The H5 app is deployed to `https://exposure.playgamelab.cn` on the existing Tencent Cloud Lighthouse server.
- Production runtime uses systemd service `ai-exposure-check-h5.service`, Caddy reverse proxy, internal port `3020`, and a server-local env file. No database, login, payment, Docker, or admin backend was added.
- Verified locally: `npm run typecheck`, `npm run build`, local `/api/health`, local `POST /api/diagnoses`, local `GET /api/diagnoses/:id`, no-key fallback, and failed-model fallback.
- Verified online: DNSPod `exposure` A record enabled, public DNS resolves, HTTPS homepage returns `200`, `/api/health` returns `model=deepseek-v4-pro`, privacy/terms pages return `200`, online `POST /api/diagnoses` returns `201`, and online `GET /api/diagnoses/:id` returns `200`.

2026-06-30 final-product adjustment:

- The H5 product no longer exposes a quick-preview option and no longer shows dual scores.
- The report now shows one `GEO 分析成果得分`.
- `POST /api/diagnoses` generates a Prompt Universe, calls DeepSeek for real answers, stores sample evidence, and builds a 9-module report surface.
- `GET /api/diagnoses/:id/evidence` returns the local evidence index for the report.
- Missing DeepSeek configuration or total sampling failure now returns an explicit `503 sampling_unavailable` instead of a fake/fallback final report.
- The final Icebox/Fridge Radar sample was generated under `outputs/h5-mvp/fridge-radar-final/`.
- Local verification: `npm run typecheck`, `npm run build`, local health, local 20-prompt fridge sample, local result screenshots.
- Online verification: `https://exposure.playgamelab.cn/` returns `200`, `/api/health` returns `samplingReady=true`, online fridge sample returned 20/20 successful samples, GET report returned `200`, GET evidence returned `200`, and mobile screenshots for start/form/result were checked.

2026-06-30 post-launch optimization completion:

- `fridge.playgamelab.cn` is now live and was used as the canonical `冰箱小雷达` test target.
- Completed the 1-6 optimization directions from `outputs/h5-mvp/fridge-radar-final/comparison-with-reference.md`:
  - re-tested H5 with the live fridge domain,
  - added URL crawling and page audit for homepage/privacy/features/FAQ/geo-case/robots/sitemap/llms,
  - added multi-provider sampling status structure while keeping only DeepSeek as real configured sampling,
  - strengthened competitor stats with prompts, snippets, misreadings, and suggested comparison content,
  - added Markdown/HTML/evidence package API exports and generated PDF artifacts,
  - completed before/after comparison for `冰箱小雷达`.
- New production release deployed to `https://exposure.playgamelab.cn` as release `202606300728`.
- Online post-launch report ID: `diag_mqzunocs_pzxoqe`.
- Online post-launch result: score `68/100（良好）`, DeepSeek `20/20`, brand mention rate `40%`, page audit `100/100` with 8/8 URL checks passing.
- Artifacts are stored under `outputs/h5-mvp/fridge-radar-post-launch/`, including local and online API responses, Markdown/HTML/PDF/evidence package exports, smoke summaries, screenshots, and `comparison-after-launch.md`.
- Frontend mobile form/result screenshots were checked. The form contains no `快速初筛` copy and the UI still shows one `GEO 分析成果得分`.
- Security check: frontend bundle contains display text `DeepSeek`, but does not contain `api.deepseek.com`, `DEEPSEEK_API_KEY`, or common `sk-...` key patterns.

Remaining risks:

- `exposure.playgamelab.cn` is suitable for technical/internal testing first. Public commercial use still needs a separate ICP/公安备案 display and主体/收费 boundary review.
- Current real sampling covers DeepSeek only. It must not be sold as full multi-platform AI visibility proof until additional platform adapters are connected to real, compliant sampling APIs.
- URL crawling/page audit is intentionally lightweight. It verifies availability and target facts, but does not yet measure search-engine indexing, WeChat search absorption, external citations, or traffic attribution.
