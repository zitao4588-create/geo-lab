# Decisions

## 2026-06-28: Use Local Knowledge Project First

Decision: create `geo-lab` as a local, file-based project first under `/Users/qzt/Developer/Playground`.

Reason: the user needs a readable, analyzable knowledge base before code or SaaS work. File-based Markdown/JSON/YAML keeps ChatGPT access simple.

## 2026-06-30: Move To Standalone Project Directory

Decision: copy `geo-lab` into `/Users/qzt/Developer/geo-lab` as a standalone project while preserving the original Playground copy for safety.

Reason: the project has become a reusable GEO knowledge and product workspace rather than a temporary Playground scratch folder.

## 2026-06-28: Separate Raw Sources From Synthesis

Decision: keep extracted/copied materials in `sources/`, and keep analysis in `knowledge/`.

Reason: GEO work has high hallucination and evidence-boundary risk. Separating raw sources from derived notes makes future claims auditable.

## 2026-06-28: Do Not Start With GEOFlow

Decision: treat GEOFlow as a reference system, not the first implementation target.

Reason: GEOFlow is a heavy Laravel/PHP content engineering and distribution system. The first sellable product should be a lightweight diagnosis/reporting workflow.

## 2026-06-28: Use Evidence Labels

Decision: every future report should label claims as `raw_source`, `verified_external`, `model_inference`, or `suggested_supplement`.

Reason: prior sample reports include simulated/virtual claims. A commercial version must separate measurable evidence from generated advice.

## 2026-06-30: Build H5 MVP Before Mini Program

Decision: create the first product surface as a mobile-first H5 app under `apps/ai-exposure-check-h5`.

Reason: H5 has the lowest launch friction for validating demand, collecting leads, and generating AI exposure reports. The app should remain compatible with a later mini-program version rather than committing to mini-program-only infrastructure on day one.

## 2026-06-30: Use Tencent TDesign For Mobile UI

Decision: use Tencent TDesign Mobile React for the H5 interface and keep the layout aligned with TDesign Miniprogram for future reuse.

Reason: the product is intended for WeChat/H5 users first, and Tencent's component system keeps the UI closer to future mini-program conventions than a generic web component library.

## 2026-06-30: Superseded Baseline - Use Rule Scoring Plus DeepSeek v4-pro Summary

Decision: generate preview reports through deterministic rule scoring first, then optionally call DeepSeek `deepseek-v4-pro` for concise Chinese summary rewriting.

Reason: rule-first output keeps evidence boundaries and fallback behavior clear. DeepSeek improves readability but must not fabricate rankings, citations, customer cases, or measured AI visibility.

Superseded: later on 2026-06-30 this was replaced by the final H5 report design: DeepSeek real sampling first, deterministic evidence-sensitive summary, one `GEO 分析成果得分`, and explicit `503 sampling_unavailable` when sampling cannot run.

## 2026-06-30: Keep DeepSeek Key Local And Ignored

Decision: store the DeepSeek API key only in `apps/ai-exposure-check-h5/.env.local`, which is ignored by Git, and do not document or print the raw key in project files.

Reason: the H5 backend needs a local model key for real MVP testing, but the key must never enter the frontend bundle, source snapshots, docs, or generated reports.

## 2026-06-30: Explicitly Load `.env.local` For Local Server Runs

Decision: change the H5 backend entrypoint to load `.env.local` before `.env`.

Reason: `dotenv/config` only loads `.env` by default, so the local DeepSeek key in `.env.local` would otherwise be ignored.

## 2026-06-30: Use `screen` Only As A Local Demo Runner

Decision: use a detached `screen` session named `ai-exposure-h5` for the current local demo service.

Reason: it keeps the local production build available at `127.0.0.1:8787` after the Codex command session ends. This is not a production process manager or deployment strategy.

## 2026-06-30: Deploy H5 MVP To `exposure.playgamelab.cn`

Decision: deploy the first H5 MVP to the existing Tencent Cloud Lighthouse server at `https://exposure.playgamelab.cn`.

Reason: the user confirmed `exposure` as the product subdomain, and the existing server already has DNSPod, Caddy, HTTPS, Node.js, and systemd patterns for lightweight services.

Implementation:

- DNS: create DNSPod A record `exposure.playgamelab.cn` pointing to the same Lighthouse server as existing PlayGameLab services.
- Runtime: systemd service `ai-exposure-check-h5.service`.
- Internal port: `3020`.
- Public entry: Caddy `reverse_proxy 127.0.0.1:3020`.
- Env: server-local `/opt/playgamelab/ai-exposure-check-h5/.env`, mode `600`, owned by `ubuntu`.
- Data: server-local runtime directory under `/opt/playgamelab/ai-exposure-check-h5/runtime`.

Boundary:

- No database, login, payment, Docker, queue worker, admin backend, mini-program, or real AI-search crawler was added.
- `exposure.playgamelab.cn` is an internal/technical test launch until备案 display and commercial主体 boundaries are reviewed.

Verification:

- `npm run typecheck` passed.
- `npm run build` passed.
- Local and online `POST /api/diagnoses` returned reports.
- Online `https://exposure.playgamelab.cn/` and `/api/health` returned HTTP `200`.
- Online smoke report ID was saved in `outputs/h5-mvp/fridge-radar-sample/online-smoke.json`.

## 2026-06-30: Upgrade H5 From Preview To DeepSeek-Sampled Final GEO Report

Decision: remove the quick-preview product mode and make `POST /api/diagnoses` produce a final-style GEO report based on real DeepSeek sampling.

Reason: the user wants the H5 product to move toward final commercial report shape instead of a lightweight initial checker. A preview report without real sampling is not strong enough for the intended GEO diagnosis product.

Implementation:

- Use one visible score: `GEO 分析成果得分`.
- Generate or accept a Prompt Universe and sample DeepSeek answers before scoring.
- Store raw sampling evidence under `runtime/evidence/<reportId>/`.
- Add `GET /api/diagnoses/:id/evidence`.
- Keep local JSON storage only; no database, login, payment, Docker, queue, admin backend, or mini-program was added.

Boundary:

- Missing API key or total sampling failure returns `503 sampling_unavailable`.
- The report must not claim full AI-platform ranking proof from a single DeepSeek run.
- `sampled_ai_answer`, `model_inference`, and `suggested_supplement` remain explicit evidence labels.

## 2026-06-30: Do Not Let Model Free-Write Evidence-Sensitive Summary

Decision: keep the final report summary deterministic after scoring; DeepSeek is used for real sampling, not for inventing the final evidence claim.

Reason: a model rewrite briefly over-stated that the AI could cite official pages and that competitor pressure was obvious. Evidence-sensitive report copy should be computed from measured fields, not freely rewritten.

## 2026-06-30: Treat Planned Or Local Pages As Unverified Infrastructure

Decision: if submitted links say `计划`、`本地`、`待上线`、`已准备` or similar wording, the H5 report treats them as unverified infrastructure rather than fully live public sources.

Reason: `冰箱小雷达` has a prepared static site, but a prepared local site is not the same as a public page that AI/search engines can access. The score should reward the plan partially without calling it verified external evidence.

## 2026-06-30: Promote Live URL Audit Into Final H5 Report

Decision: once `fridge.playgamelab.cn` went live, the H5 report should crawl and score the submitted public pages instead of relying on submitted link text.

Reason: a final GEO report needs to distinguish a planned/local page from a public, reachable, machine-readable source. Live URL audit is the minimum evidence step before calling infrastructure verified.

Implementation:

- Audit homepage, privacy, features, FAQ, GEO case, `robots.txt`, `sitemap.xml`, and `llms.txt`.
- Record HTTP status, title/meta where applicable, matched facts, missing facts, and evidence labels.
- Use the audit score as the `可查证基建` dimension when public URLs are present.

Boundary:

- This is not a full crawler, search-engine index checker, WeChat search monitor, or SEO/GEO ranking proof.
- It only verifies that the submitted public pages are reachable and contain expected facts at audit time.

## 2026-06-30: Represent Multi-Provider Sampling Without Fabricating Results

Decision: add multi-provider status fields for DeepSeek, 豆包, Kimi, 元宝, 通义, and 文心, but only DeepSeek produces real samples for now.

Reason: the final report needs a shape that can grow into multi-platform GEO sampling, while evidence discipline requires unconfigured platforms to be marked `unavailable` instead of simulated.

Implementation:

- `aiMeta.provider` is now `multi`.
- DeepSeek returns real `sampled` or `partial` status.
- Other providers are listed as `unavailable` with explicit notes that no simulated answers are generated.

## 2026-06-30: Add Formal Report Export Package

Decision: each generated report should have Markdown, HTML, and evidence package exports, with PDF generated from the HTML report for the current test artifacts.

Reason: the H5 result page is useful for interaction, but commercial handoff needs stable report files and evidence attachments.

Implementation:

- Added `GET /api/diagnoses/:id/export/markdown`.
- Added `GET /api/diagnoses/:id/export/html`.
- Added `GET /api/diagnoses/:id/export/evidence-package`.
- Local and online `冰箱小雷达` PDF artifacts were generated with Playwright from the HTML export.

Boundary:

- Server-side PDF generation is not yet exposed as an API endpoint.
- Word export is deferred.

## 2026-06-30: Use `冰箱小雷达` Post-Launch Retest As Canonical Before/After

Decision: treat the live `fridge.playgamelab.cn` retest as the canonical H5 before/after sample.

Reason: it proves the product can move from "planned/local page" diagnosis to a live public-page audit, while keeping the same 20 prompt baseline for comparison.

Result:

- Before launch: score `61/100`, DeepSeek mention rate `40%`.
- After launch: score `68/100`, DeepSeek mention rate `40%`, page audit `100/100`.
- Interpretation: infrastructure improved materially, but model mention rate did not move in the same run; next work should focus on absorption, external citations, and repeated monitoring rather than assuming immediate AI visibility lift.

## 2026-07-03: Initialize Git Before Further H5 Changes

Decision: initialize local Git for `/Users/qzt/Developer/geo-lab` and make a first repository snapshot before continuing conversion/product changes.

Reason: the workspace now contains a deployable H5 product plus research material. Further product changes and deployment work need rollback points, remote backup, and explicit ignored-secret boundaries.

Boundary:

- `.env.local`, runtime data, dependencies, and build output stay ignored.
- GitHub remote creation and first push are treated as an explicit external sync step.

## 2026-07-03: Use Optional Contact Plus QR Handoff For Free Initial Check

Decision: make `contact` optional and let users generate the free H5 initial diagnosis without leaving contact details. Result-page consultation and appointment CTAs open the WeChat QR modal instead.

Reason: forcing contact before report generation increases drop-off and mixes the free initial check with paid/manual service conversion too early. QR handoff keeps the initial report usable while still giving a clear consultation path.

Boundary:

- Report export and evidence package viewing must not be blocked when contact is empty.
- The QR image is a public product asset; no phone number or personal contact identifier is hardcoded into the frontend bundle.

## 2026-07-03: Add Strict In-Memory Diagnosis Rate Limits

Decision: protect `POST /api/diagnoses` with default in-memory limits of one diagnosis per IP per hour and 30 diagnoses globally per day.

Reason: each diagnosis can trigger real model sampling. Before adding accounts, billing, or a durable queue, strict local limits are the simplest guardrail against accidental cost spikes or lightweight abuse.

Boundary:

- Limits are process-memory only and reset on restart.
- This does not add a database, login, payment, queue, or Docker.
- Environment variables can loosen or tighten the limits during controlled tests.

## 2026-07-03: Show备案 Information With Explicit Subdomain Review Caveat

Decision: display `陕ICP备2026012759号-2` and `陕公网安备61010202000523号` in the H5 footer and legal pages, while explicitly noting that `exposure.playgamelab.cn` needs final subdomain/subject review before public commercial promotion.

Reason: the product needs a more formal compliance surface than placeholders, but current local备案 evidence is not enough to treat the exposure subdomain as fully cleared for public paid promotion.

Boundary:

- H5 automatic initial diagnosis remains free.
- Manual complete diagnosis, interpretation, and optimization services require separately confirmed scope and pricing.
- No online payment, contract flow, or paid entitlement is added in this batch.

## 2026-07-06: Keep The H5 As Delivery-Only Product Surface

Decision: treat `AI曝光体检` H5 as a delivery/report/demo surface. It can collect a free report request, show the generated report, and guide users to WeChat consultation, but transaction, quote, payment, invoice/tax, refund, and formal service delivery confirmation happen outside the H5.

Reason: the current ICP/Tencent/public-security filing surfaces are suitable for a cautious delivery/demo posture, but public hard promotion and explicit commercial transaction posture require service-name and domain/from-domain alignment. Keeping the H5 delivery-only avoids turning the page into a payment/order/contract surface before that review is complete.

Boundary:

- No price table, payment button, order flow, contract flow, paid entitlement, invoice/tax promise, or refund policy is added to the H5.
- WeChat QR/consultation can remain as post-report handoff, but service scope and quote are confirmed outside the H5.
- Footer备案 numbers and the exposure-subdomain caveat stay visible.
- Public hard promotion or paid ads wait for ICP/Tencent service naming and公安备案 domain/from-domain confirmation or update.
- The product must still not promise AI ranking, recommendation lift, or multi-platform coverage from DeepSeek-only sampling.

## 2026-07-07: Use A Concise Competitor-Risk Headline

Decision: use `别让 AI / 只推荐竞品` as the H5 first-screen headline and `AI曝光体检 · 别让 AI 只推荐竞品` as the browser title.

Reason: the earlier question-style headline was accurate but less direct. The new headline is shorter, clearer, and immediately frames the practical GEO risk without promising ranking improvement.

Boundary:

- The headline must not be expanded into a guarantee that the tool can force AI recommendation or ranking lift.
- Supporting copy should keep the real scope: `30 秒看清你的 AI 曝光风险` and DeepSeek-based initial diagnosis.

## 2026-07-07: Store Promotion Source Internally Only

Decision: accept hidden `?from=` / `?utm_source=` attribution from the H5 and write the sanitized value to `runtime/submissions.jsonl`, but do not expose it in public report pages, exported reports, or evidence packages.

Reason: first-batch promotion needs lightweight channel review before any analytics stack exists. Runtime JSONL is enough for the current delivery/demo phase and avoids adding database, login, tracking SDK, cookies, or admin infrastructure.

Boundary:

- Source strings stay short and non-sensitive.
- This is operational attribution, not evidence for GEO report scoring.
- The implementation must remain compatible with the no-database/no-login/no-payment constraint.

## 2026-07-07: Avoid Costly Online POST Smoke For UI/Attribution-Only Releases

Decision: for releases that do not change sampling behavior, production smoke can verify build, bundle, health, existing report reads, service state, and deployed schema/code without sending a fresh online `POST /api/diagnoses`.

Reason: each new diagnosis can consume real DeepSeek sampling quota and interact with strict rate limits. For UI/title/source-field releases, a controlled POST should be reserved for explicit acceptance checks or first real campaign traffic.

Boundary:

- If sampling logic, validation required fields, storage write behavior, or report generation changes materially, run a controlled POST smoke and record the report ID.
- When POST smoke is skipped, document that it was skipped and specify what was verified instead.
