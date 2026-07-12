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
- A mobile-first H5 AI exposure diagnosis product for lead capture and four-model GEO sampling reports.

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
- Model adapters: Alibaba Bailian DeepSeek and Qwen, Tencent TokenHub Hunyuan, and Volcengine Ark Doubao through OpenAI-compatible APIs.
- Report mode: four models sample the same 10-question set in parallel, then transparent rule scoring produces one `GEO 分析成果得分`.
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

2026-07-07 controlled attribution and visual smoke closeout:

- With explicit user approval, sent one controlled online `POST /api/diagnoses` using the canonical `冰箱小雷达` payload plus `source: codex_test`.
- New online validation report: `diag_mra0oo9j_xnru7x`, score `68/100（良好）`, risk `medium`, DeepSeek `20/20`, page audit `100/100`.
- Verified public reads and exports: `GET /api/diagnoses/:id`, `/evidence`, `/export/markdown`, `/export/html`, and `/export/evidence-package` all returned `200`.
- Verified server runtime attribution: `runtime/submissions.jsonl` contains the new report row with `source: "codex_test"` and empty `contact`.
- Verified public privacy boundary: the report JSON, Markdown export, and evidence package do not expose `codex_test`, `source`, or `contact`.
- Completed screenshot-level visual smoke with Playwright for mobile and desktop start/report pages. Evidence is stored under `outputs/h5-mvp/visual-smoke-20260707/`.
- Visual smoke results: no horizontal overflow, no console error/warning, mobile consult modal opens, QR image loads, WeChat ID/copy button are visible, and stable report score ring shows `68` after the count-up animation completes.
- No additional diagnosis POST was sent during the visual smoke; it reused `diag_mra0oo9j_xnru7x`.

2026-07-08 search discoverability release:

- Added crawler-readable static discovery files for the H5:
  - `apps/ai-exposure-check-h5/public/robots.txt`,
  - `apps/ai-exposure-check-h5/public/sitemap.xml`,
  - `apps/ai-exposure-check-h5/public/ai-exposure-check.html`.
- Updated `apps/ai-exposure-check-h5/index.html` with canonical, sitemap link, and a no-JS fallback pointing to the static introduction page.
- The static introduction page explains `AI曝光体检`, the GEO initial-diagnosis workflow, report modules, the `冰箱小雷达` case, and evidence boundaries. It keeps the same constraints: no ranking guarantee, DeepSeek-only real sampling for now, no simulated unconfigured-platform results, and no transaction/payment/order flow inside the H5.
- Deployed production release `20260708163730` to `https://exposure.playgamelab.cn`, replacing `20260707095202` (kept for rollback).
- Verification passed: `npm run typecheck`, `npm run build`, sitemap XML validation, frontend bundle secret scan, release precheck on port `8790`, production service `active`, current symlink `releases/20260708163730`, homepage `200`, `/api/health` `samplingReady=true`, `/robots.txt` `text/plain`, `/sitemap.xml` `application/xml`, `/ai-exposure-check.html` `200`, and existing report `diag_mra0oo9j_xnru7x` still `200`.
- No new online `POST /api/diagnoses` was sent in this release smoke because the change only affects static discovery surfaces and existing report reads.

2026-07-10 report submission and recovery reliability release:

- Root cause of the July 8 usability incident: the server had generated and saved the report, but the client did not receive/finalize the response; a second submission then hit the existing one-per-IP hourly limit.
- Added a frontend `clientRequestId` stored with the form signature in `sessionStorage` (`aiec_pending_request`). Reloads and retries of the same form reuse the same ID; successful completion clears it.
- Added in-flight request coalescing plus persistent `runtime/request-index/<clientRequestId>.json` lookup before quota consumption. A matching retry returns the same report; the same ID with different normalized input returns `409 idempotency_conflict`.
- Kept the original limits unchanged: a genuinely different request ID still consumes/checks the one-per-IP hourly and 30/day global quotas. No database, login, payment, queue, Docker, new sampling platform, scoring change, or new UI was added.
- Added Node integration tests with a local OpenAI-compatible fake provider for lost responses, in-flight and persisted retry, process restart recovery, different-ID `429`, invalid-ID `400`, sampling failure `503`, single-write behavior, and request-ID privacy.
- Local verification passed: `npm run typecheck`, `npm run build`, `npm test` (2/2), bundle secret scan, API integration checks, and a real-browser offline/reload/retry flow. Controlled record: `outputs/h5-mvp/idempotency-recovery-20260710/acceptance.md`.
- Code commit `0ca1179 Fix H5 diagnosis retry recovery` was pushed to `origin/main` and deployed as production release `20260710114018`, replacing `20260708163730` (kept for rollback).
- Production smoke passed: systemd `active`, homepage/health/robots/sitemap/static introduction page `200`, existing July 8 report and export still `200`, deployed frontend contains `aiec_pending_request`, and invalid request ID returns `400` without model usage.
- With explicit approval, one real controlled response-loss test generated `diag_mrenc8ay_27tgnk` with DeepSeek `20/20`. The first client timed out after 5 seconds; the same-ID retry returned `200`, persisted replay returned the same report in about 1.15 seconds, and a different ID returned `429` without another model run.
- Server evidence shows one request index and one submission row for the report; public report/evidence exports do not expose request ID. From first sample start to request-index save took about `76.3` seconds, with per-prompt average `9285ms` and max `16979ms`.

2026-07-11 multi-provider speed work and Doubao intake:

- Production sampling now uses DeepSeek `deepseek-v4-pro`, Tencent TokenHub `hy3`, and Alibaba Model Studio `qwen3.7-plus` in parallel. The default prompt universe was reduced from 20 to 10 prompts per provider, so the current three-provider production path makes 30 model calls per diagnosis.
- Qwen's Node transport `Premature close` failure was fixed by using Node 22 native `fetch`. A controlled public diagnosis completed with all three providers at `20/20` before the default prompt reduction; total sampling time was about `48.6` seconds.
- The local H5 branch now includes a fourth OpenAI-compatible adapter for Volcengine Ark Doubao, targeting `doubao-seed-2-0-lite-260215`, concurrency `4`, one retry, and disabled thinking. Local typecheck, production build, and all five integration tests pass; the controlled four-provider test completed in about `455ms`, and quota fallback completed in about `171ms`.
- The user confirmed all required Volcengine Ark model services are activated and that the Ark console currently shows free quota. The exact free-quota amount and expiry were intentionally not recorded because they can change.
- A live console check on 2026-07-11 showed initial free resource packages of 500,000 remaining tokens each for Doubao Seed 2.0 Lite, 2.0 Mini, 2.1 Turbo, 2.1 Pro, and 1.8. These balances are a point-in-time snapshot, not a durable guarantee.
- The Doubao runtime order is 2.0 Lite -> 2.0 Mini -> 2.1 Turbo -> 1.8 -> 2.1 Pro. Explicit activation/quota/balance/rate-limit errors trigger fallback; proactive switching still depends on the console's free-resource balance because ordinary Chat responses do not identify the free-to-paid boundary.
- With explicit user consent, the collaboration reward plan was enabled on 2026-07-11 for Doubao Seed 2.0 Lite, 2.0 Mini, 2.1 Turbo, 1.8, and 2.1 Pro plus their preset inference endpoints. All five model cards were rechecked in the console and showed `已授权` with no `立即授权` action.
- Reward packages are normally issued around 11:00 the next day and remain valid for 30 days. The desired operating order is reward quota first and initial free quota second, but the actual package deduction order is controlled by Volcengine billing and cannot be selected or verified by this H5.
- One controlled real Doubao request succeeded with a valid answer in about `899ms` and one completion token. The existing `DOUBAO_API_KEY` is stored only in ignored `apps/ai-exposure-check-h5/.env.local` with mode `600`; its value is not documented.
- Doubao code and configuration are locally verified and awaiting commit, push, and deployment under the user's explicit L4 authorization.

2026-07-11 free-tier product scope update:

- The user changed the DeepSeek decision: DeepSeek remains in the free H5, but moves from the DeepSeek official API to Alibaba Bailian `deepseek-v4-pro`. The same Bailian credential also serves `qwen3.7-plus`; Tencent TokenHub serves `hy3`, and Volcengine Ark serves Doubao.
- The free product promise is now three cloud platforms and four model APIs: Bailian DeepSeek, Alibaba Qwen, Tencent Hunyuan/Hy3, and Volcengine Doubao. API samples are not represented as consumer-app search results.
- A live Bailian console check showed `deepseek-v4-pro` at `1,000,000 / 1,000,000` free tokens and `qwen3.7-plus` at `977,829 / 1,000,000`, both expiring on 2026-10-10 with `免费额度用完即停` enabled.
- The production Bailian workspace key remains IP-restricted and now authorizes only `qwen3.7-plus` and `deepseek-v4-pro`. A controlled request from the allowlisted production server returned HTTP `200` for `deepseek-v4-pro` in about `1.43s`; local requests correctly remain blocked by the IP allowlist.
- Tencent TokenHub's same-day usage page showed about `13.64K` tokens consumed by `hy3`; it did not expose a machine-readable free remaining balance or free-only stop state. The existing one-IP/hour and 30/day product limits remain the conservative application guardrail.
- The local implementation adds independent `DEEPSEEK_ENABLED`, `QWEN_ENABLED`, `HY3_ENABLED`, and `DOUBAO_ENABLED` switches. The old `DEEPSEEK_API_KEY` is ignored by the sampling code.

2026-07-11 three-cloud/four-model production release:

- Commit `b4d6000` was pushed to `origin/main` and deployed as release `20260711132550`, replacing `20260711082835` (kept for rollback).
- The server environment now enables Bailian DeepSeek, Bailian Qwen, Tencent Hy3, and Volcengine Doubao. The environment file remains mode `600`; the pre-change environment was backed up before the atomic merge.
- Verification passed: `npm run typecheck`, `npm run build`, `npm test` (5/5), `git diff --check`, release precheck on port `8790`, frontend bundle copy checks, systemd `active`, production homepage/privacy/terms/static introduction page `200`, and `/api/health` with `samplingReady=true` plus four `ready` providers.
- Real Chrome checks confirmed the deployed homepage and form show the three-cloud/four-model wording without visible overflow. No form submission was made through the browser.
- With prior explicit approval, a one-question controlled production diagnosis generated `diag_mrfxefwo_5gpi7o` in about `10.6s`. DeepSeek, Hy3, Qwen, and Doubao each returned `1/1` successful sample; persisted report recovery returned `200` in about `301ms`.
- The controlled one-question result proves all four production adapters and parallel aggregation work. It does not yet measure the default 10-question-per-model end-to-end latency.

2026-07-11 DeepSeek free-tier fallback release:

- Commit `02e36cd` was pushed to `origin/main` and deployed as release `20260711141454`, replacing `20260711132550` (kept for rollback).
- DeepSeek now samples `deepseek-v4-pro` first and switches to `deepseek-v4-flash` only for explicit `402/403/404/429` quota, free-tier, access, rate-limit, or model-availability failures. Timeouts, `5xx`, and empty answers do not trigger cross-model replay; if Flash also fails, the DeepSeek sample stays failed instead of falling back to legacy models.
- The Bailian production key remains IP-restricted and custom-scoped to `qwen3.7-plus`, `deepseek-v4-pro`, and `deepseek-v4-flash`. The server environment includes `DEEPSEEK_FALLBACK_MODELS=deepseek-v4-flash` and remains mode `600` with a pre-change backup.
- Verification passed: typecheck, production build, `git diff --check`, integration tests `6/6`, clean release precheck on port `8790`, production systemd `active`, current symlink, public health with four ready providers, and homepage/privacy/terms/static introduction page `200`.
- No production diagnosis POST was sent for this release, so no additional cloud-model quota was consumed during deployment smoke.

Remaining risks:

- `exposure.playgamelab.cn` is suitable for delivery/demo/report entry first. Public commercial promotion still needs ICP/Tencent service naming and公安备案 domain/from-domain alignment review.
- Alibaba's free-tier-only stop is enabled for DeepSeek and Qwen. Tencent and Volcengine do not expose an equivalent reliable free-balance signal to the H5, so their console balances still require manual monitoring and provider disable/switch before paid usage.
- URL crawling/page audit is intentionally lightweight. It verifies availability and target facts, but does not yet measure search-engine indexing, WeChat search absorption, external citations, or traffic attribution.
- Newly added robots/sitemap/static page lower the crawling barrier, but they do not guarantee immediate WeChat search inclusion or ranking. Actual discovery still depends on external crawlers, content distribution, links, and WeChat ecosystem signals.
- The latest four-provider one-question diagnosis took about `10.6s`; the previous three-provider 20-prompt diagnosis took about `48.6s`. The current default 10-question-per-provider path has not yet been measured end to end and will be bounded by the slowest provider plus page audit.
- Idempotency is durable for the current single-instance, shared-runtime deployment. Rate-limit counters remain process-memory only and reset on restart; request-index JSON is not a multi-instance coordination system.

2026-07-12 report credibility hardening (local C2, not deployed):

- Added a deterministic input preflight before quota consumption and model sampling. Sparse/ambiguous input returns `422 input_confirmation_required`; the H5 shows the missing evidence and does not enter the loading screen.
- Report schema `0.4` adds business type, confidence, score visibility, string mention, correct entity recognition, unbranded natural recommendation, misrecognition, provider agreement, model conflicts, confirmed facts, unverified facts, and next actions. Version `0.3` remains readable.
- Prompt Universe and recommendations now route between physical products, software/mini-programs, local services, and unknown inputs. Physical products no longer receive mini-program privacy/photo/payment templates.
- Missing URLs now show page audit as `未检测` with infrastructure score `0`; user-facing total score is withheld when there is no verified public source. Markdown, HTML, H5, and evidence package share the same credibility data.
- Fixed fixtures prove the intended contrast: `冰箱小雷达` keeps page audit `100/100` but now reports correct entity recognition `0%` and natural recommendation `0%`; the Panasonic fixture catches ES-LV9C vs official ES-LM55 conflicts; a fictitious brand is blocked before sampling.
- Local verification: typecheck/build pass, tests `13/13`, mobile/desktop/preflight browser QA with no overflow or console errors. Evidence: `outputs/h5-mvp/report-credibility-hardening-20260712/`.
- No production POST, deployment, commit, push, paid search provider, or cross-project fridge-site edit was performed.

2026-07-12 multi-type batch instance testing (local C2, not deployed):

- Added one table-driven 20-case matrix covering physical products, software/mini-programs, local services, adversarial inputs, and system regression.
- Phase A ran validation/preflight only: 20/20 passed after fixes, with zero real model calls and zero quota consumption.
- Fixed two P1 issues with regression tests: local services using `全国/不限/线上` now require a concrete city/store/radius; partial provider failure now lowers report confidence.
- Fixed one P0 evidence-boundary issue: unsupported user claims are no longer shown under “已确认”; user descriptions remain pending verification until PageAudit evidence supports them.
- Fixed the H5 provider strip so a configured provider failure is shown as failure coverage rather than “未配置”.
- Verified Markdown, HTML, evidence package, and the report object use the same credibility values.
- Completed 10 real local-page visual checks: five required states at 390×844 and 1440×1000, without horizontal overflow or console errors/warnings.
- Phase B was not run because current runtime configuration cannot reliably prove Tencent and Volcengine calls will remain free; this follows the Goal cost stop condition.
- Evidence is under `outputs/h5-mvp/batch-instance-testing-20260712/`. No commit, push, deployment, production POST, or production runtime change was made.

2026-07-12 batch Phase B real-run closeout (local C2, not deployed):

- The user explicitly confirmed the Volcengine free boundary and authorized the full Phase B run. P01, P02, S01, L01, and L03 generated five new isolated local reports; S02 reused the saved 2026-07-11 four-provider evidence without a new call.
- The five real reports covered 50 unique questions and 200 provider/prompt slots. Volcengine Doubao succeeded 50/50. Bailian DeepSeek, Bailian Qwen, and Tencent Hy3 each failed 0/50 because the current source IP is outside their API Key allowlists. DeepSeek additionally attempted the configured Flash fallback for all 50 prompts and received the same 403 restriction.
- All five new reports correctly dropped to low confidence and withheld the user-facing total score. No simulated provider results, billing signal, balance error, or paid-provider addition occurred.
- Real visual QA found a P0 consistency bug: the main cover withheld the score while the desktop preview and report summary still exposed the internal compatibility score. The minimal fix now derives summary copy from `scoreStatus`, hides the score in the preview/cover copy, and adds `displayedScore: null` to the evidence package when withheld.
- Final local verification passed: typecheck, build, `npm test` 40/40, `git diff --check`, and two real-report Playwright checks at 390×844 and 1440×1000 with no overflow or console errors. Provider error persistence now redacts API keys, bearer tokens, and source IPs. The real-run evidence and final conclusions are in `outputs/h5-mvp/batch-instance-testing-20260712/stage-b-report.md` and `stage-b-summary.json`.
- Current conclusion: credibility protection passes, but the four-provider runtime does not pass (0/5 complete reports). Remaining blockers are the Bailian/TokenHub IP allowlists and PageAudit false negatives for the Panasonic and Haidilao official pages.
2026-07-12 source recognition hardening (local acceptance complete, deployment pending):

- The controlled local execution IP is now present in the existing Bailian and TokenHub allowlists. Minimal calls for DeepSeek, Qwen, and Hy3 succeeded, and the saved full run records 200/200 four-provider samples with zero fallback. Exact IP values remain outside project files.
- PageAudit now audits the full submitted URL instead of discarding its path and only probing origin-relative H5-specific routes.
- Submitted pages record separate `sourceRelation` and `scopeRelation` values, so an entity-matched store-search entry can remain scope-partial while a national brand homepage is scope-mismatched for a specific store.
- Live official-page checks: Panasonic P01/P02 are `entity_matched + matched + ok` and bind primary model `ES-LM55`; Haidilao L01 is `entity_matched + partial` because the no-JavaScript page does not prove Xi'an; L03 is `entity_matched + mismatched`.
- A submitted model that conflicts with the verified official primary model is now an explicit high-severity issue and unverified fact. P02 records `ES-LV9C` versus `ES-LM55` instead of hiding the conflict inside provider rows.
- Deterministic verification passes: typecheck, build, `git diff --check`, and 47/47 tests. Twelve real-page visual checks at 390×844 and 1440×1000 have zero overflow and zero console errors.
- Phase B reports were rebuilt with fresh PageAudit results and the previously saved 200/200 successful real four-provider samples, so this Goal added zero model calls. P01/P02/S01 are score-available; L01/L03 remain withheld for the expected scope reasons.
- Evidence: `outputs/h5-mvp/source-recognition-hardening-20260712/`. Deployment, production switch, and online smoke are still pending at this checkpoint.
