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

2026-07-03 T1 Git protection and T8 first-batch conversion safeguards:

- Initialized local Git for `/Users/qzt/Developer/geo-lab`.
- Created local commits:
  - `3a04856 Initial geo-lab snapshot`
  - `2c3b706 Implement H5 conversion safeguards`
- Confirmed ignored runtime/secret/build surfaces stay out of Git, including `.env.local`, `node_modules/`, `dist/`, and `apps/ai-exposure-check-h5/runtime/`.
- Copied the user-provided WeChat QR image from `/Users/qzt/Downloads/IMG_2538.jpg` to `apps/ai-exposure-check-h5/public/wechat-qr.jpg`.
- Changed the H5 contact field from required to optional across frontend validation, shared types, server validation, and stored report input.
- Changed result-page consultation CTAs to open a QR modal with copy action instead of inert buttons.
- Added stricter in-memory anti-abuse limits for diagnosis creation: default single IP `1/hour`, global `30/day`, both configurable by environment variables.
- Kept the existing safety behavior: no API key or total sampling failure returns `503 sampling_unavailable` instead of generating a fake report.
- Updated first-screen copy, start CTA, industry shortcut tags, export guidance, footer备案 display, privacy policy, terms, and production runbook.
- Local verification passed:
  - `npm run typecheck`
  - `npm run build`
  - local no-contact `POST /api/diagnoses` returned `201`, report `diag_mr4v7m7n_0x9v8d`
  - local `GET /api/diagnoses/diag_mr4v7m7n_0x9v8d` returned `200`
  - repeated local diagnosis creation returned `429`
  - desktop and mobile browser checks confirmed the optional contact flow, industry tags, QR modal, and QR image loading
  - refined frontend bundle scan found no `DEEPSEEK_API_KEY`, `api.deepseek.com`, or OpenAI-style `sk-...` key patterns
- GitHub private remote created and pushed: `https://github.com/zitao4588-create/geo-lab`.
- New production release deployed to `https://exposure.playgamelab.cn` as release `20260703201836`, replacing `202606300728`.
- Online smoke report ID: `diag_mr4wim6t_gfcg0g`.
- Online smoke passed: homepage `200`, `/api/health` `samplingReady=true`, no-contact `POST /api/diagnoses` `201`, `GET` report `200`, evidence index `200`, Markdown/HTML/evidence-package exports `200`, and repeated POST `429`.
- Release evidence is stored under `outputs/h5-mvp/t8-p0-release-20260703201836/`.
- Compliance review status:
  - Online footer/bundle displays `陕ICP备2026012759号-2`, `陕公网安备61010202000523号`, and the caveat `备案展示以 exposure 子域名最终核验为准`.
  - Online privacy/terms state that H5 automatic initial diagnosis is free and manual complete diagnosis, interpretation, optimization, monthly retest, pricing, delivery, cycle, and refund boundaries are separately confirmed.
  - Local备案 evidence still points to Monday Survival: website name `今天你能熬过周一吗`, website address `https://monday.playgamelab.cn`, ICP `陕ICP备2026012759号-2`, and public security filing `陕公网安备61010202000523号`.
  - Therefore `exposure.playgamelab.cn` remains suitable for technical/internal testing, but public paid promotion still requires final subdomain/service-item/subject confirmation in备案 and公安备案 backends or with the access provider.

2026-07-05 UI refresh release:

- Full UI/UX redesign of the H5 (start/form/loading/result) for a cleaner, more premium look: dark navy hero with an AI chat demo on the start screen, report-cover score card with risk-colored ring, grouped form fields, calmer provider status display, and a single consult CTA.
- Fixed a real bug: the consult modal was hijacked out of the viewport by a retained `transform` from the screen entrance animation (`fill-mode: both`).
- All compliance surfaces kept unchanged in meaning:备案 numbers, subdomain caveat, privacy/terms links, evidence-boundary and no-simulated-results copy.
- Code commit: `dc6b59d Redesign H5 UI for premium feel and conversion`.
- New production release deployed to `https://exposure.playgamelab.cn` as release `20260705175108`, replacing `20260703201836` (kept for rollback).
- Online smoke passed: homepage `200` with new bundle hashes, `/api/health` `samplingReady=true`, privacy/terms `200`, pre-existing report `diag_mr4wim6t_gfcg0g` still `200` (shared RUNTIME_DIR), test `POST /api/diagnoses` generated `diag_mr7m81bl_mzlv8i` with `aiMeta.successCount=20/20`, report/evidence/exports all `200`, bundle contains no key patterns, and mobile/desktop online screenshots show no horizontal overflow.
- Release evidence is stored under `outputs/h5-mvp/ui-refresh-release-20260705175108/`.

2026-07-06 UX batch release:

- Declutter pass on the start screen (single trust line replaces eyebrow chip, promise descriptions and card note), unified "例如：…" placeholders, and the contact field removed from the form — contact intent now flows only through the post-report WeChat CTA (API keeps accepting optional contact).
- Conversion/waiting improvements: sticky consult bar on the result page, copy-report-link action, collapsible answer/audit evidence, score count-up, tappable not-ready submit with missing-field targeting, in-page rate-limit consult card, staged loading copy with rotating GEO tips and a beforeunload guard, sessionStorage form draft, chat-demo entrance animation, SVG favicon, legal pages aligned to the design tokens.
- Code commits: `da7a339`, `f783016`.
- Deployed to `https://exposure.playgamelab.cn` as release `20260706165543`, replacing `20260705175108` (kept for rollback).
- Online smoke: homepage/health/legal/favicon `200` with new bundle hashes, existing report and all exports `200`, no horizontal overflow on mobile/desktop shots, consult bar verified live mid-scroll. No new POST sampling this round (server source unchanged; quota saved) — noted as a deliberate runbook deviation.
- Release evidence under `outputs/h5-mvp/ux-batch-release-20260706165543/`.

2026-07-06 Claude Code sync and compliance boundary update:

- Synced the Claude Code H5 changes into the project context: UI refresh release `20260705175108`, UX/conversion release `20260706165543`, and the promotion-plan draft under `knowledge/product/h5-promotion-plan.md`.
- The user clarified the H5 is a delivery/report/demo product surface. Transactions, paid scope, quote confirmation, payment, invoice/tax, refund, and formal service delivery boundaries happen outside the H5.
- Read-only backend/public filing checks confirmed the current filing surfaces are still centered on `playgamelab.cn` and a personal subject/service context, while the public-security record name and from-domain do not specifically name `exposure.playgamelab.cn`.
- Current allowed boundary: `exposure.playgamelab.cn` can continue as a delivery/demo/report entry with footer备案 caveat, no price/payment/order/contract flow, and no promise of AI ranking or multi-platform coverage.
- Public hard promotion, paid ads, or a more explicit commercial landing-page posture should wait until ICP/Tencent service naming and public-security domain/from-domain display are confirmed or updated.
- `marketing/` now contains the first promotion-material batch committed as `c31873b`: WeChat article, Zhihu answers, Xiaohongshu posts, Moments/groups copy, short-video script, and two poster PNGs with HTML sources. The materials are drafts for user review, not published content.
- A local follow-up revised `marketing/wechat-article-fridge-case.md` into a less AI-flavored version and added `marketing/image-prompts.md` with illustration prompts plus a real-screenshot checklist. These should be reviewed with the same evidence and compliance red lines before release.
- The consultation QR image already exists at `apps/ai-exposure-check-h5/public/wechat-qr.jpg`, copied earlier from `/Users/qzt/Downloads/IMG_2538.jpg`. The remaining `VITE_CONSULT_WECHAT_ID` task is for the copyable WeChat ID text in the modal, not for the QR image itself.

2026-07-06 marketing draft and WeChat-ID release:

- Generated the full first-batch visual assets from `marketing/image-prompts.md`: W1/W2/W3, X1/X2/X3, V1, M1, plus a compressed W1 cover image under `marketing/posters/generated/`.
- Captured real report screenshots from the live report page under `marketing/posters/screenshots/`; these are evidence screenshots, not AI-generated report mockups.
- Uploaded the "less AI-flavored" WeChat article and its article-specific images to the WeChat Official Account draft box. The draft was created successfully through the official draft API; it was not published.
- Built and deployed release `20260706212541` to `https://exposure.playgamelab.cn` so the consultation modal copies the configured WeChat ID instead of the generic add-WeChat instruction.
- Verification passed: `npm run typecheck`, `npm run build`, bundle scan for DeepSeek secrets, release precheck on port `8790`, production service `active`, homepage `200`, `/api/health` `samplingReady=true`, existing report page `200`, and Playwright verification that the live consult modal displays the configured WeChat ID.
- Release evidence is stored under `outputs/h5-mvp/wechat-id-release-20260706212541/`.

2026-07-07 H5 title/form polish and source-tracking release:

- Polished the first-screen positioning into a concise pain-oriented headline: `别让 AI / 只推荐竞品`, with browser title `AI曝光体检 · 别让 AI 只推荐竞品`.
- Unified all visible form fields to single-line inputs for a consistent mobile rhythm.
- Added lightweight hidden promotion attribution from `?from=` / `?utm_source=`. The frontend sends sanitized `source`, the server validates it, and runtime storage writes it to `runtime/submissions.jsonl`; public report and evidence exports do not expose this field.
- Code commit: `2fcca26 Add H5 source tracking and headline polish`.
- Deployed to `https://exposure.playgamelab.cn` as release `20260707095202`, replacing `20260706212541` (kept for rollback).
- Verification passed: `npm run typecheck`, `npm run build`, frontend bundle scan found no `DEEPSEEK_API_KEY`, `api.deepseek.com`, `DEEPSEEK_BASE_URL`, `DEEPSEEK_MODEL`, or OpenAI-style `sk-...` key patterns; release precheck on port `8790`; production service `active`; homepage `200`; `/api/health` `samplingReady=true`; privacy/terms `200`; existing report `diag_mqzunocs_pzxoqe` returned `200` with score `68/100` and DeepSeek `20/20`; deployed code/schema accepts sanitized `source`.
- No new online `POST /api/diagnoses` was sent in this release smoke to avoid consuming DeepSeek quota and resetting/triggering rate limits. Source tracking was verified by deployed schema/current code, and should be confirmed with the first real campaign submission or a deliberately approved controlled POST.
- In-app browser visual preview could not be completed because the browser automation page was blocked by URL-policy/localhost-refusal behavior; curl/systemd smoke checks were used for production verification.

Remaining risks:

- `exposure.playgamelab.cn` is suitable for delivery/demo/report entry first. Public commercial promotion still needs ICP/Tencent service naming and公安备案 domain/from-domain alignment review.
- Current real sampling covers DeepSeek only. It must not be sold as full multi-platform AI visibility proof until additional platform adapters are connected to real, compliant sampling APIs.
- URL crawling/page audit is intentionally lightweight. It verifies availability and target facts, but does not yet measure search-engine indexing, WeChat search absorption, external citations, or traffic attribution.
