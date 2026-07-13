# Decisions

## 2026-07-11: Route DeepSeek Through Alibaba Bailian Free Tier

Decision: stop using the DeepSeek official API for the H5. Use the existing Alibaba Bailian OpenAI-compatible credential for both `deepseek-v4-pro` and `qwen3.7-plus`, while continuing to sample Tencent TokenHub `hy3` and Volcengine Ark Doubao in parallel.

Reason: the user wants the free H5 to cover three cloud platforms and four models without consuming the DeepSeek official account. Bailian currently provides a hard “free quota exhausted, stop service” control for both Alibaba-hosted models.

Boundary:

- The product describes API answer sampling, not the consumer apps' search results or guaranteed rankings.
- DeepSeek uses `deepseek-v4-pro` first and `deepseek-v4-flash` only after explicit quota, free-tier, balance, rate-limit, access, or model-availability errors. If both are unavailable, DeepSeek stays failed for that sample; the runtime does not fall back to legacy V3, R1, or distilled models.
- On 2026-07-11, Bailian showed `1,000,000 / 1,000,000` free tokens for `deepseek-v4-pro` and `977,829 / 1,000,000` for `qwen3.7-plus`, expiring on 2026-10-10; both had free-tier-only stop enabled.
- The production workspace key is restricted to the production server IP and to the two selected models. A controlled server-side `deepseek-v4-pro` call returned HTTP `200` after the model permission was added; the key was not reset or broadened to all models.
- These balances are point-in-time evidence. Each provider also has an explicit runtime enable switch so operations can disable it before paid usage.
- Tencent and Volcengine still require console monitoring because their normal inference responses do not provide a reliable free-balance signal to the H5.

## 2026-07-11: Enable Doubao Collaboration Rewards With Quota-Aware Fallback

Decision: with explicit user consent, authorize the collaboration reward plan for Doubao Seed 2.0 Lite, 2.0 Mini, 2.1 Turbo, 1.8, and 2.1 Pro plus their preset inference endpoints. Configure the H5 to use those models in that order and fall back only after explicit activation, quota, balance, billing, resource-package, or rate-limit errors.

Reason: the user wants to consume available free resources before paid usage while keeping diagnosis latency bounded through provider-level parallelism and model-level fallback.

Boundary:

- The reward plan grants model/endpoint data-collection permission; it was not enabled until the user explicitly agreed.
- Reward packages are normally issued around 11:00 the next day and are valid for 30 days.
- Volcengine billing controls resource-package deduction order. The H5 cannot guarantee or detect that reward quota is consumed before initial free quota.
- Chat responses do not expose reliable free-balance state. Console balance remains the source of truth, and exhausted free quota can otherwise roll into postpaid usage.

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

## 2026-07-07: Use One Approved Controlled POST To Validate Attribution

Decision: after release `20260707095202`, use exactly one explicitly approved controlled online `POST /api/diagnoses` with a short non-sensitive source label (`codex_test`) to verify end-to-end attribution before real promotion traffic.

Reason: deployed schema/code verification proved that `source` was accepted, but only a real POST could confirm the production runtime row in `submissions.jsonl` and prove that public report/export surfaces did not leak operational attribution. One controlled POST is enough for this acceptance check and avoids repeated DeepSeek quota/rate-limit cost.

Boundary:

- Controlled attribution checks should use short, non-sensitive labels.
- Record the generated report ID and whether public exports expose internal fields.
- Do not repeat costly POST checks for visual-only smoke; reuse an existing report unless sampling, storage, validation, or report generation behavior changed.
- Continue to keep source attribution operational only, not part of GEO evidence scoring.

## 2026-07-08: Add Static Discovery Surfaces Before Expecting Search Inclusion

Decision: add real `robots.txt`, valid `sitemap.xml`, and a crawler-readable static introduction page for `AI曝光体检` before expecting WeChat search or web search to discover the H5 reliably.

Reason: the H5 is primarily a React app and report tool. Its previous `/robots.txt` and `/sitemap.xml` paths fell through to the SPA homepage, which was poor crawler hygiene. A static HTML page gives crawlers and share previews a stable, text-readable explanation of the product, evidence boundaries, and `冰箱小雷达` case without requiring JavaScript execution.

Boundary:

- This is a discovery and crawling hygiene improvement, not a guarantee of WeChat search inclusion, ranking, traffic, or conversion.
- The static page must keep the same compliance boundaries as the H5: no price/payment/order/contract flow, no AI ranking guarantee, no fabricated multi-platform results, and clear DeepSeek-only sampling scope.
- Generated report URLs remain private-by-link operational artifacts and should not be added to the public sitemap.

## 2026-07-10: Resolve Matching Diagnosis Retries Before Consuming Quota

Decision: each H5 submission may include a form-bound `clientRequestId`. The server checks a matching in-flight task or persistent runtime request index before consuming the existing diagnosis quota, so a lost response or retry can return the same generated report.

Reason: a real report was generated and saved on July 8, but the client did not display/finalize the response. Retrying the same diagnosis then hit the one-per-IP hourly limit and looked like both a missing report and exhausted quota. The reliability contract must distinguish a retry of the same work from a new diagnosis.

Implementation:

- The frontend stores `{ id, signature }` in `sessionStorage` under `aiec_pending_request` and reuses it only while the normalized form signature matches.
- The server coalesces matching in-flight requests and stores `runtime/request-index/<clientRequestId>.json` after report artifacts are written.
- Request indexes include a SHA-256 fingerprint of normalized inputs. Reusing an ID with different input returns `409 idempotency_conflict`.
- Matching in-flight or persisted retries return `200`; a first successful generation still returns `201`.

Boundary:

- Existing one-IP/hour and 30/day limits remain unchanged for new request IDs.
- Failed generation creates no report index and keeps the existing quota-consumption semantics.
- Request IDs stay internal and are excluded from `submissions.jsonl`, public reports, and evidence packages.
- This remains a local-file, single-instance design; no database, login, queue, payment, Docker, or new UI was introduced.
- Costly production recovery checks require explicit user approval and should generate exactly one real report, then use same-ID replay and different-ID `429` for the remaining assertions.

## 2026-07-12: Separate Evidence Completeness From AI Entity Recognition

Decision: introduce report schema `0.4` and treat string appearance, correct entity recognition, unbranded natural recommendation, misrecognition, provider agreement, public page audit, and report confidence as separate measurements.

Reason: two real cases proved the old total score was easy to misread. `冰箱小雷达` had complete public infrastructure but no reliable organic entity recognition, while a real Panasonic product received a low score because the user did not submit its existing official page. String echo and form completeness cannot stand in for GEO understanding.

Boundary:

- Branded-question echo never counts as natural recommendation.
- Correct entity recognition requires a submitted public source that passes PageAudit; otherwise it is N/A.
- No URL means page audit `未检测`, not a synthetic baseline score.
- Low-evidence reports withhold the user-facing total score.
- Candidate-source discovery remains backend-only and is not simulated when no provider is configured.

## 2026-07-12: Route Diagnosis By Business Type

Decision: infer or confirm `physical_product`, `software_or_miniprogram`, `local_service`, or `generic_or_unknown` before building the Prompt Universe and recommendations.

Reason: the generic mini-program-oriented template produced irrelevant privacy, WeChat, AI/photo/payment, and CSDN advice for a physical shaver. Domain routing is required for user trust.

Boundary:

- Unknown types stop at preflight until clarified.
- Physical-product guidance centers on official model, specifications, safety, channels, consumables, warranty, and comparable SKUs.
- Software/privacy questions are used only when the submitted facts support that product type.
- No database, login, payment, queue, or new infrastructure is introduced.

## 2026-07-12: Stop Batch Phase B When Free Cost Cannot Be Proven

Decision: complete all deterministic 20-case testing and local visual evidence, but do not start new real sampling for P01/P02/S01/L01/L03 while Tencent and Volcengine free-only execution cannot be reliably confirmed from runtime state. Reuse the saved S02 evidence only.

Reason: provider configuration and historical free balances do not prove a new call cannot become billable. The batch Goal explicitly makes uncertain cost a stop condition.

Boundary:

- Phase A must keep real model calls and quota consumption at zero.
- A later Phase B requires fresh proof that every enabled target provider is free or hard-stopped before billing.
- S02 must not be resampled; use `outputs/h5-mvp/fridge-radar-4model-20260711/`.
- No new provider, production POST, deployment, commit, or push is part of this batch.

## 2026-07-12: Resume Phase B After Explicit Cost Confirmation, But Treat Allowlist Failure As A Real Result

Decision: after the user explicitly confirmed the Volcengine console boundary and authorized full Phase B, run the five new real instances locally with all four configured providers and reuse S02 without resampling.

Result: Doubao completed 50/50 samples. Bailian DeepSeek/Qwen and Tencent Hy3 rejected the current source IP with 403 allowlist restrictions. These failures are recorded as Phase B evidence, not retried or converted into simulated answers.

Boundary:

- A configured/ready health status does not prove the current execution host is authorized by a provider's API Key allowlist.
- Permission/allowlist errors are stop signals for future runners, just like billing and quota errors; `run-stage-b.mjs` now enforces this.
- The batch may be C2 for local implementation and evidence collection while still failing four-provider runtime readiness.
- Do not change cloud allowlists, production runtime, deployment state, or API keys inside this Goal.

## 2026-07-12: Withheld Score Must Not Leak Through Summary Or Preview Surfaces

Decision: whenever `stages.credibility.scoreStatus` is `withheld`, every user-facing surface must say `暂不评分`/`暂不展示总分` and must not repeat the internal compatibility score.

Reason: real Phase B visual QA showed the report cover withholding the score while the desktop preview and report summary still displayed `44/100`. This is a P0 cross-surface consistency failure even though the underlying compatibility score remains useful internally.

Boundary:

- H5 cover, desktop preview, Markdown, HTML, and evidence-package display semantics all derive from `scoreStatus`.
- The internal numeric score may remain for schema compatibility, but the evidence package also exposes `displayedScore: null` when withheld.
- Regression coverage must use a below-50% provider scenario, because 50% partial coverage intentionally produces medium confidence rather than mandatory score withholding.
## 2026-07-12: Separate Source Identity From Business Scope

Decision: PageAudit must audit the exact user-submitted URL and record source/entity relation separately from product, model, city, or store scope.

Reason: the previous implementation discarded submitted paths. It audited the Panasonic origin instead of the ES-LM55 product page and the Haidilao origin instead of `/serve/storeSearch`. HTTP 200 and same-domain pages also could not explain whether a page proved a specific model or store.

Boundary:

- `entity_matched` does not automatically mean `scope matched`.
- A store-search entry may be entity-matched but scope-partial when it does not expose the submitted city or store.
- A national brand homepage is scope-mismatched for a specific local-service claim.
- Only scope-verified targets can support correct entity-recognition rates or score availability.
- Submitted facts that conflict with a verified primary model must remain explicit, high-severity evidence conflicts.
- No search provider, database, login, payment, cloud permission, or production-data change is introduced.

## 2026-07-12: Verify Source Facts Before Consuming Diagnosis Quota

Decision: after deterministic input readiness passes, audit the submitted source and reject a verified primary-model conflict before consuming the diagnosis quota or starting provider sampling.

Reason: the previous flow ran PageAudit and provider sampling concurrently after quota consumption. A user-visible ES-LV9C/ES-LM55 conflict was reported only after paying the sampling cost.

Boundary:

- Missing or partial sources still follow the existing credibility/withheld-score contract; only a verified direct fact conflict blocks this G1 path.
- Idempotent persisted/in-flight recovery remains before a fresh PageAudit, so a matching retry does not repeat work.
- No real provider, production write, database, login, payment, Docker, or cloud configuration change is part of G1.

## 2026-07-12: Separate Submitted Source Trust From Site Infrastructure Completeness

Decision: keep submitted-source trust and site-infrastructure completeness as independent scores and user-facing labels.

Reason: a valid official product page can prove the entity and primary model even when the host lacks this H5's preferred FAQ, privacy, sitemap, and llms endpoints. Combining both into one low aggregate made a verified source look untrustworthy.

Boundary: source trust controls whether entity facts can be verified; site infrastructure remains a separate optimization dimension and does not inherit a high score from one valid product page.

## 2026-07-12: Use One Explicit Product Definition Across Human And Machine Surfaces

Decision: define AI曝光体检 as a multi-model GEO entity-recognition and public-evidence diagnostic tool for brand and product owners, and publish the same definition in human-readable pages, metadata, JSON-LD, sitemap-linked surfaces, and `llms.txt`.

Reason: “AI exposure check” and “体检” are ambiguous without a category and exclusions. The previous copy could be interpreted as medical/body-image inspection, privacy-leak scanning, or advertising exposure analytics.

Boundary:

- Public content explains inputs, workflow, four output dimensions, privacy handling, scoring limits, and evidence provenance.
- Historical samples are evidence-boundary examples, not customer outcome claims.
- Publishing content does not prove search indexing, model absorption, natural recommendation, traffic, or commercial uplift.
- G2 does not include deployment, real model retesting, paid promotion, or cross-platform publishing.

## 2026-07-12: Fail Closed Before PageAudit Network Access

Decision: PageAudit validates protocol, credentials, IP ranges and a stable double DNS resolution before every manually handled redirect hop; it limits MIME, timeout and streaming bytes before treating content as evidence.

Reason: a user-submitted URL is untrusted input. The previous direct `fetch` with automatic redirects could reach private resources, follow unsafe redirects or allocate an unbounded body.

Boundary:

- Production defaults reject private and reserved IPv4/IPv6. Test-only loopback requires an explicit child-process allowlist.
- A dynamic renderer is optional and caller-injected; it only handles detected JavaScript shells and cannot upgrade entity scope by itself.
- Search discovery is not added. User URLs enter a local `pending_review` candidate queue and remain unverified until PageAudit confirms entity and scope.
- This design does not add a proxy, browser cloud service, database, queue, login, provider, or paid API.

## 2026-07-12: Provider Configuration Is Not Runtime Or Cost Readiness

Decision: health and sampling must distinguish `configured`, `samplingAllowed`, `costGuard`, and `lastRealSuccessAt`. Tencent and Volcengine require both manual confirmation and a future expiration; missing or expired confirmation is fail-close.

Reason: an API key and a historical successful call do not prove that a new call is authorized, free, or safe from postpaid billing. A permanent boolean can also outlive the console evidence it represented.

Boundary:

- DeepSeek/Qwen retain provider-enforced free-only handling; Tencent/Volcengine require time-bounded manual evidence.
- A `ready` health state only means current configuration and cost gate permit sampling, not that the provider just succeeded.
- Runtime observations record only operational aggregates and Prompt IDs, not form data or Prompt text.
- Production commit/push/deploy/POST remain behind the explicit G4 confirmation gate.

## 2026-07-12: Persist Single-Instance Rate Limits Without Raw IPs

Decision: persist hourly client and global daily quota counters in one atomic JSON state file, using salted SHA-256 client identifiers.

Reason: process-memory limits reset on restart, allowing accidental quota bursts immediately after a deploy or crash.

Boundary: this is only valid for the current single-instance deployment. Multi-instance coordination still requires a separate design and is not implied by this file.

## 2026-07-13: One-Time Cost-Gate Override For G4 Production Acceptance

Decision: honor the user's explicit instruction to skip current cloud-console quota verification and run one production acceptance report, while limiting Tencent and Volcengine sampling permission to a short expiration window.

Reason: browser control could not access the logged-in consoles, and the user chose deployment and production validation despite the unresolved free-versus-paid status.

Boundary:

- This is authorization for one report, not evidence that any provider call was free.
- Same request ID replay may recover the persisted report but must not create another report.
- The short cost permission expires automatically; future production sampling requires new evidence or explicit cost authorization.
- No API Key value, account detail, source IP or billing data is written to project files.

## 2026-07-13: Let Provider Switch Plus Configured Key Control Sampling

Decision: remove time-bounded manual cost gates from Hy3 and Doubao sampling eligibility. All four providers use an independent enable switch plus configured key; emergency disable, model fallback, failure classification, persistent rate limits, and billing/authorization monitoring remain.

Reason: the user explicitly accepted possible real model charges and asked runtime claims to reflect the actual executable path. Expired manual timestamps made configured, enabled providers look unavailable even when the user had authorized real calls.

Boundary:

- `configured` proves only that a key is present; it does not prove the key is currently valid.
- `enabled + configured` allows a request; `lastRealSuccessAt` and the latest operation prove only the recorded real run.
- Hy3/Doubao may incur paid usage. Unexpected billing, quota, authorization, or quality signals require disabling that provider and restarting the service.
- Legacy environment variable names can be removed only after separate approval to edit the production environment file; the new code does not read them.

## 2026-07-13: Keep WeChat JSSDK Optional And Server-Isolated

Decision: deploy an allowlisted server-side JSSDK signature/cache module and modern share-data calls, while keeping the H5 fully usable through ordinary link-copy and WeChat menu guidance when account prerequisites or credentials are missing.

Reason: WeChat WebView recovery and generic sharing can ship independently, but authenticated friend/timeline card configuration requires account permissions, a JS security domain, AppID/AppSecret, and real-device validation.

Boundary:

- AppSecret, access token, and jsapi ticket never enter the repository, browser bundle, logs, reports, or acceptance output.
- The signature endpoint accepts only HTTPS URLs on `exposure.playgamelab.cn`, keeps the query, removes the hash, and returns only public signature parameters.
- No OAuth, OpenID, login, payment, profile, or follower data is introduced.
- Until account and true-device checks pass, documentation must say “fallback deployed, JSSDK not configured,” not “WeChat sharing launched.”

## 2026-07-13: Use One Authoritative Diagnosis POST

Decision: make `POST /api/diagnoses` the only diagnosis entry. It performs deterministic input checks, one PageAudit/source assessment, quota consumption, real provider sampling, deterministic scoring, and persistence in that order.

Reason: the previous client preflight plus formal POST duplicated network PageAudit and could make the user wait twice for the same source evidence.

Boundary:

- 422 input/source rejection occurs before quota and provider sampling.
- Persisted/in-flight idempotency recovery remains ahead of fresh work and returns the same report.
- No database, queue, worker, microservice, login, payment, Docker, or admin backend is added.

## 2026-07-13: Pause WeChat JSSDK Account Integration

Decision: stop the account-side WeChat JSSDK integration for the current release and keep the deployed ordinary share/copy fallback as the supported WeChat path.

Reason: screenshots from the WeChat developer platform confirmed that the existing public account is personal and not certified, while its JS interface security domain is unset. The visible basic server API permissions do not establish the friend/timeline custom-share permission required by this release. The user chose not to pursue this account path now.

Boundary:

- No AppID/AppSecret was written to production and no public-account configuration was changed.
- The isolated signature module may remain dormant; missing credentials must continue to degrade safely without blocking diagnosis or report viewing.
- Resume only with an account that demonstrably has the required sharing permission, a configured `exposure.playgamelab.cn` JS security domain, explicit authorization for account changes, and real iOS/Android WeChat acceptance.
- Do not describe the fallback as native JSSDK sharing or count the paused true-device checks as passed.

## 2026-07-14: Split Free H5 Diagnosis From Formal Consumer-Side Reports

Decision: keep the free H5 as a multi-model API brand-recognition and public-evidence preliminary diagnosis, while moving formal customer work into a separate Codex workflow based on fresh DeepSeek, 通义, 腾讯元宝, and 豆包 consumer sessions plus source verification and human scoring.

Reason: the measurement-validity run found only 2/8 strict target recognition pairs aligned, 5/8 conflicted, and 1/8 was not comparable. Consumer products automatically searched in many answers while the measured APIs were offline, producing opposite conclusions about whether products existed and what they did.

Boundary:

- The H5 score is an `初步诊断分`, not consumer exposure, search ranking, or stable recommendation position.
- API non-mention cannot be sold as proof that the consumer product does not expose or recommend the brand.
- Formal reports require preserved consumer answers, screenshots, citations, source-map verification, controls, and human evaluation; the API report cannot be promoted into a formal report automatically.
- A consumer answer is still a point-in-time observation, not a stable platform ranking.

## 2026-07-14: Use Volcengine Plus AnySearch Only For Candidate Discovery

Decision: run Volcengine Web Search and AnySearch in parallel with the four H5 model providers, merge and deduplicate candidate URLs, and score only public-evidence discoverability. Keep candidates outside verified facts until PageAudit or manual verification supports them.

Reason: candidate discovery improves the free H5's usefulness without repeating the invalid claim that API sampling represents consumer search. The search canary showed AnySearch was useful for candidate URLs and Volcengine could return grounded citations inside the 30-second engineering window, but no provider passed all original hard gates.

Boundary:

- Search remains backend-only; keys and anonymous-provider details never enter the browser bundle.
- Candidate titles, snippets and URLs keep `suggested_supplement` status and cannot prove product facts by themselves.
- Production enables only Volcengine and AnySearch. Tavily and Jina remain available adapters, not production sources.
- AnySearch anonymous commercial terms and long-term free stability remain unverified. Volcengine search may add model-token cost; either source must be independently disabled on billing, authorization, quota, or reliability anomalies.
- The 30-second SLA is an internal engineering target. One 27.535-second canary with 37/40 model successes is not a public performance promise or P95 proof.
