# Bug Notes

## 2026-06-30: `.env.local` Was Not Loaded By Default

Symptom: after writing the DeepSeek key into `apps/ai-exposure-check-h5/.env.local`, the backend code still used `import 'dotenv/config'`, which only loads `.env` by default.

Cause: `.env.local` is a Vite-style convention, but the Node backend needs explicit dotenv loading.

Fix: changed the backend entrypoint to call `dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })` before `dotenv.config()`.

Verification: `npm run typecheck` and `npm run build` passed; `/api/health` reports `model: deepseek-v4-pro`.

## 2026-06-30: Background Restart Needed Elevated Process Control

Symptom: stopping the old `127.0.0.1:8787` process failed inside the sandbox with `operation not permitted`. Plain `nohup` and non-elevated `screen -dmS` did not leave a listening service.

Cause: local process management was restricted by the Codex sandbox/session environment, not by the H5 app itself.

Workaround: used approved elevated process control to stop the old H5 process, then started a detached `screen` session named `ai-exposure-h5`.

Verification: `lsof -nP -iTCP:8787 -sTCP:LISTEN` showed a Node listener, and `curl http://127.0.0.1:8787/api/health` returned `{ "ok": true, "service": "ai-exposure-check-h5", "model": "deepseek-v4-pro" }`.

Note: this is suitable for local testing only. Production should use a normal server process manager or platform runtime after deployment is chosen.

## 2026-06-30: First Sample Generation Script Hit Ambiguous Module Syntax

Symptom: the first local Node one-off script for generating the `冰箱小雷达` sample report failed before calling the API with `ERR_AMBIGUOUS_MODULE_SYNTAX`.

Cause: the script mixed CommonJS `require` with top-level `await`.

Fix: reran the generation as an ESM `node --input-type=module` script using `import` and `fetch`.

Verification: local `POST /api/diagnoses` returned HTTP `201`, with DeepSeek status `used`; the report artifacts were saved under `outputs/h5-mvp/fridge-radar-sample/`.

## 2026-06-30: Playwright Screenshots Needed Elevated macOS Permissions

Symptom: headless Chromium launched by Playwright failed inside the Codex sandbox with a Mach port `Permission denied` error.

Cause: macOS sandbox restrictions blocked Chromium's Mach port registration.

Workaround: reran the same screenshot script with approved elevated execution. No browser cookies, login state, or secrets were used.

Verification: local and online screenshots were saved under `outputs/h5-mvp/fridge-radar-sample/screenshots/`.

## 2026-06-30: macOS Tar Extended Attributes Produced Server Warnings

Symptom: extracting the deployment tarball on Ubuntu printed repeated `Ignoring unknown extended header keyword 'LIBARCHIVE.xattr.com.apple.provenance'` warnings.

Cause: macOS added extended attribute metadata to the tar archive.

Impact: extraction and deployment still succeeded; this did not affect runtime files.

Verification: `npm ci --omit=dev` completed on the server, `ai-exposure-check-h5.service` became `active`, and `https://exposure.playgamelab.cn/api/health` returned HTTP `200`.

## 2026-06-30: DeepSeek Report Polish Overstated Evidence

Symptom: the first final-shape `冰箱小雷达` report used real DeepSeek sampling, but the optional DeepSeek polish step rewrote the summary to say AI could stably reference official/source pages and that competitor pressure was obvious.

Cause: the polishing prompt had access to sampled metrics, but free-form summary rewriting still introduced stronger claims than the measured fields supported.

Fix: keep the final report summary deterministic from the scoring data. DeepSeek remains the sampling engine, but evidence-sensitive summary copy no longer relies on free-form model rewrite.

Verification: regenerated the fridge report after the change. The final local sample is stored under `outputs/h5-mvp/fridge-radar-final/` with score `61/100`, 20/20 DeepSeek samples, and a conservative summary.

## 2026-06-30: Planned Static Site Was Initially Scored As Verified Infrastructure

Symptom: the first final-shape `冰箱小雷达` sample scored `可查证基建` as `100` because the submitted links included `https://fridge.playgamelab.cn` plus local static pages.

Cause: the rule only detected the presence of URLs and page keywords, but did not distinguish `计划域名`、`本地静态站`、`已准备` from a public, already reachable source.

Fix: downgrade links containing planned/local/not-yet-live wording to `warn` and partial credit. They are treated as raw user-submitted signals, not verified external evidence.

Verification: regenerated the sample. `可查证基建` became `65`, public entrance and page checks are `warn`, and the final score became `61/100`.

## 2026-06-30: Health Check Provider List Marked DeepSeek As Unavailable

Symptom: `/api/health` returned `samplingReady=true`, but the provider list still showed DeepSeek as `unavailable`.

Cause: the health endpoint reused the unavailable-provider placeholder builder before any sampling had run.

Fix: added a `ready` sampling status for health checks and made DeepSeek report `ready` when the server has a configured API key.

Verification: local and online `/api/health` now show `samplingReady=true` and DeepSeek status `ready`.

## 2026-06-30: Live Site Recommendations Still Looked Like Pre-Launch Advice

Symptom: after `fridge.playgamelab.cn` was live, the report still recommended "搭建最小可查证品牌介绍页".

Cause: recommendations and roadmap did not branch on live page audit score.

Fix: when page audit score is high, the report now recommends strengthening the already-live brand site into an AI-citable content pool instead of building a first page.

Verification: post-launch report `diag_mqzunocs_pzxoqe` recommends "把已上线品牌站补成 AI 可引用内容池" and page audit is `100/100`.

## 2026-06-30: Sitemap Audit Was Too Strict For URL-Only Facts

Symptom: the first live URL audit marked `sitemap.xml` as `warn` because it did not match the privacy fact token, even though it listed `/privacy/`.

Cause: the fact dictionary had content words for privacy/FAQ/features, but not the path tokens used inside sitemap XML.

Fix: added path tokens such as `/privacy/`, `/faq/`, and `/features/` to the fact dictionary.

Verification: regenerated the post-launch report; page audit became `100/100` with 8/8 targets passing.

## 2026-07-03: In-App Browser DOM Snapshot Was Unavailable During QR Modal QA

Symptom: the in-app browser QA path could open the H5 page, but the DOM snapshot helper failed with a runtime error before returning an accessibility snapshot.

Cause: the browser tool runtime did not expose the expected incremental snapshot function in this session.

Workaround: verified the same frontend behavior through Playwright-style locators, direct browser evaluation, screenshots, and console checks instead of relying on the DOM snapshot helper.

Verification: desktop and mobile checks confirmed no required-contact blocking, industry shortcut tags worked, result CTAs opened the QR modal, `/wechat-qr.jpg` loaded with nonzero natural dimensions, and no console errors or warnings were observed.

## 2026-07-07: Release Precheck Initially Hit An Old Port 8790 Process

Symptom: the first precheck request to `127.0.0.1:8790` returned the previous homepage title even though the uploaded release files already contained the new title.

Cause: an older temporary Node precheck process was still listening on port `8790`, so curl was hitting the stale process instead of the newly uploaded release.

Fix: checked the listener PID on the server, killed the old temporary precheck process, started the new release on port `8790`, and repeated health/homepage checks before switching the `current` symlink.

Verification: release `20260707095202` precheck returned `/api/health` with `samplingReady=true` and homepage title `AI曝光体检 · 别让 AI 只推荐竞品`; production was then switched and systemd reported `active`.

## 2026-07-07: In-App Browser Visual Smoke Was Blocked During Production Preview

Symptom: attempting to open the production URL with the in-app browser preview path showed a tool-side URL-policy/localhost-refusal error instead of the live H5 page.

Cause: the browser automation context was still tied to an old localhost preview state and refused the navigation path; this was a tooling/browser-control problem, not an application response failure.

Workaround: used bounded production curl/systemd checks instead: homepage `200`, `/api/health` `samplingReady=true`, privacy/terms `200`, existing report `diag_mqzunocs_pzxoqe` `200`, current release symlink, and deployed bundle/title checks.

Verification: production release `20260707095202` is active and serving the new title/bundle. A fresh visual browser pass can be run later if a UI screenshot is specifically needed.

## 2026-07-07: Visual Smoke Needed Elevated Chromium And Stable Selectors

Symptom: the first Playwright visual smoke attempt failed with macOS Mach port permission errors. After rerunning outside the sandbox, two script-side checks failed: `getByText('GEO 分析成果报告')` matched both the heading and footer text, and a later stable-score check used the wrong selector `.score-number strong`.

Cause: headless Chromium needs elevated macOS process permissions in this Codex environment. The selector failures were QA-script issues, not application failures. An early screenshot also caught the score count-up animation before it finished, temporarily showing a lower ring number than the final report score.

Workaround: reran headless Chromium with approved elevated execution, changed the report wait to `getByRole('heading', { name: 'GEO 分析成果报告' })`, changed the score selector to `.cover-ring strong`, and waited for the 900ms count-up animation to settle before taking stable report screenshots.

Verification: `outputs/h5-mvp/visual-smoke-20260707/visual-smoke-summary.json` and `visual-smoke-stable-report-summary.json` show mobile/desktop start and report checks with no horizontal overflow, no console issues, loaded consult QR, and stable displayed score `68`.

## 2026-07-10: Generated Report Was Lost To The Client And Retry Hit The Hourly Limit

Symptom: the July 8 diagnosis generated a valid server-side report, but the client did not display the result. Retrying from the same IP showed the hourly free quota as exhausted.

Cause: diagnosis quota was consumed before generation, while submissions had no stable client request ID. A disconnected/lost response was therefore indistinguishable from a new diagnosis attempt.

Fix: added form-bound client request IDs, matching in-flight request coalescing, persistent request-to-report indexes, and input fingerprints. Matching retries are resolved before quota consumption; mismatched reuse returns `409`.

Verification: local integration and browser tests passed. Production release `20260710114018` generated controlled report `diag_mrenc8ay_27tgnk`; the first client timed out, same-ID retry returned `200`, persisted replay returned the same ID, different-ID submission returned `429`, and runtime contains one submission row.

## 2026-07-10: Port 8790 Precheck Process Survived SSH Session Exit

Symptom: after interrupting the SSH command that launched the temporary precheck server, `127.0.0.1:8790` was still listening.

Cause: the local SSH session exited without forwarding the interrupt to the detached remote Node process.

Fix: identified the exact listener PID with `ss`, terminated only that temporary PID, and verified port `8790` was empty before switching production.

Verification: the production service on `3020` remained active throughout; the new release was switched only after the temporary port was clean.

## 2026-07-11: Npm Precheck Left A Grandchild Node Process On Port 8790

Symptom: the first fallback-release precheck appeared healthy, but `ss` showed port `8790` was still owned by an older Node process from release `20260711132550`.

Cause: the earlier `nohup npm --prefix <release> start` launch stored the npm wrapper PID. Stopping that PID did not terminate the detached grandchild Node process, so a later health request could hit stale code.

Fix: inspected the exact listener PID and command, terminated only the stale precheck process, verified the port was empty, then launched the new release with `env -C <release> node dist/server/server/index.js`. This makes the stored PID the actual Node process.

Verification: the clean precheck PID had working directory `releases/20260711141454`; homepage and health returned `200`, all four providers were ready, and port `8790` was empty after stopping the recorded PID. Production was switched only after this verification.

## 2026-07-12: Report Export Mixed Infrastructure Dimension With Page Audit

Symptom: the external shaver report summary said page audit `0/100`, while Markdown/HTML headers displayed `20/100`.

Cause: exporters rendered `report.stages.infrastructure.score`, which included synthetic no-URL baseline points, instead of the actual `pageAudit.score` and target state.

Fix: no-URL infrastructure now scores `0`; H5, Markdown and HTML show `未检测` when there are no audit targets and use the actual PageAudit score otherwise.

Verification: `report-credibility.test.mjs` asserts the export never shows `20/100` for a no-URL report; three output surfaces share the same credibility structure.

## 2026-07-12: Preflight Rejected Empty Client Request ID

Symptom: the new form preflight returned `validation_error` instead of showing the evidence-insufficient card.

Cause: the draft form sends `clientRequestId: ""`, while the server schema accepted only an omitted value or a 12-80 character ID.

Fix: validation now accepts either an empty string or a valid request ID. Full diagnosis submission still generates and validates its normal stable ID.

Verification: Playwright filled the sparse Panasonic form, displayed the preflight card, confirmed no overflow or console errors, and the integration test proves preflight rejection does not consume quota or call the fake provider.

## 2026-07-12: Local Service Without Concrete Coverage Passed Preflight

Symptom: a local service with city set to `全国` passed preflight as `ready` even though no city, store, or service radius was established.

Cause: preflight awarded city completeness for any non-empty string and did not apply a local-service scope rule.

Fix: local services using an empty city, `全国`, `不限`, or `线上` now return `needs_confirmation` and request a concrete city, store, or service radius.

Verification: `L02` first failed and then passed in `batch-instance-matrix.test.mjs`.

## 2026-07-12: Partial Provider Failure Kept High Confidence And Looked Unconfigured

Symptom: a report with a verified page and one successful plus one failed provider still showed high confidence; the failed provider was grouped into the H5 “未配置” note.

Cause: confidence only used PageAudit quality, and the frontend grouped every non-sampled/non-partial status as unconfigured.

Fix: confidence now incorporates actual sampling coverage. Any partial coverage caps high confidence at medium; below 50% becomes low. The H5 separately renders configured failures with their success/total count.

Verification: `report-credibility.test.mjs` covers confidence downgrade; batch visual QA confirms the partial-failure page shows medium confidence and `豆包 · 失败 0/1` on both viewports.

## 2026-07-12: Unsupported User Claims Appeared Under Confirmed Facts

Symptom: a local-service description containing unproved claims such as `百分百除菌`, `全城最低价`, and `绝对安全` appeared in the report's “已确认” column.

Cause: `buildConfirmedFacts` copied the full user-submitted description. The provenance prefix did not prevent the UI from visually treating those claims as confirmed.

Fix: confirmed facts now contain the deterministic business type, submitted target audience, audited page count, and facts matched by successful PageAudit targets. The user-submitted business description is listed under “仍待核验”.

Verification: the unsupported-claims regression confirms the claims are absent from `confirmedFacts`, present in `unverifiedFacts`, and the score remains withheld without a verified source. All 10 visual checks were regenerated afterward.

## 2026-07-12: Real Phase B Was Blocked By API Key IP Allowlists

Symptom: each of the five real Phase B reports had only 10/40 successful provider samples.

Cause: Bailian DeepSeek and Qwen returned `403 IP access denied by API-Key restrictions`; Tencent Hy3 returned `403 Source IP ... is not in the API Key allowlist`. Volcengine Doubao succeeded 10/10 for every report.

Handling: kept the successful Doubao samples, recorded all three failed providers, lowered confidence, withheld user scores, and did not alter cloud allowlists or production runtime. The first runner continued across later cases because it only stopped on billing/quota signals; the runner now also stops on 403/access/allowlist signals. It was not rerun to avoid duplicate free-quota use.

Verification: `stage-b-summary.json` records 50 successes, 150 failed provider slots, 50 DeepSeek fallback prompts, 0/5 complete four-provider reports, and no billing signals.

## 2026-07-12: Withheld Report Leaked Internal Score In Preview And Summary

Symptom: the real S01 report cover displayed `暂不评分`, but its desktop preview showed `44分 · 待提升` and the report summary/Markdown/HTML repeated `综合得分 44/100`.

Cause: `scoreStatus` controlled the primary score label, while `buildSummary` used only PageAudit availability and `DesktopPreview` always rendered `report.score`.

Fix: build summary copy from the final credibility `scoreStatus`; render withheld-specific copy in the cover and desktop preview; add `displayedScore: null` to the evidence package when the score is withheld.

Verification: the 25%-coverage regression asserts that H5/export summaries contain no precise total score; `npm test` passes 40/40. Real-report Playwright QA passes at 390×844 and 1440×1000 with `暂不评分` on both visible score surfaces, no overflow, and no console errors.

## 2026-07-12: Provider Error Persisted The Source IP

Symptom: TokenHub's 403 allowlist message included the current public source IP in `samples.json`.

Cause: provider error sanitization redacted API keys and bearer tokens but not IPv4 addresses.

Fix: `sanitizeProviderError` now replaces IPv4 values with `[redacted_ip]`; the saved Phase B samples and summaries were sanitized in place and regenerated without making new provider calls.

Verification: the new regression covers API key, bearer token, and source-IP redaction. A repository/output scan finds no retained source IP value in the batch artifacts.
## 2026-07-12: PageAudit Discarded Submitted Paths And Hid Scope Mismatches

Symptom: P01/P02 submitted the Panasonic ES-LM55 product URL but PageAudit fetched only the site origin; L01 submitted Haidilao's store-search path but PageAudit also fetched the origin. Correct pages were false negatives, while SPA fallback pages appeared as generic warnings.

Cause: `inferBaseUrl` reduced the first submitted URL to protocol plus host, then the audit used a fixed H5-specific path list for every site.

Fix: audit the exact submitted URL as the primary target, extract its canonical primary model, and record `sourceRelation` plus `scopeRelation`. Supplemental discovery paths remain separate infrastructure evidence.

Verification: five new PageAudit regressions failed 0/5 before the fix and pass 5/5 after it. Live checks bind Panasonic ES-LM55, keep Haidilao store search scope-partial, mark the national homepage scope-mismatched, and reject an unrelated weather page. Full regression is 47/47.

## 2026-07-12: Submitted Model Conflict Was Not Explicit In The Report

Symptom: P02 used an official ES-LM55 page while the submitted description claimed ES-LV9C. Provider rows showed misrecognition, but the report did not directly state the user-source fact conflict.

Fix: compare submitted model identifiers with scope-verified official primary models and add `issue_source_fact_conflict` plus a direct unverified-fact statement.

Verification: the new regression failed before the fix and now passes. The rebuilt P02 report explicitly states `ES-LV9C` versus `ES-LM55` and retains the provider conflict evidence.

## 2026-07-12: Source Conflict Consumed Quota And Sampling Before Confirmation

Symptom: an input claiming ES-LV9C with an audited ES-LM55 official page could start provider sampling and consume a diagnosis slot before the conflict was shown.

Cause: the POST path consumed quota and launched PageAudit/provider sampling concurrently; the original preflight checked only input completeness and did not audit the URL.

Fix: preflight can now return a source-aware confirmation assessment. The diagnosis POST re-audits the source before quota and passes the verified PageAudit into report generation only after the conflict gate succeeds.

Verification: the controlled integration test returns needs_confirmation/422 with zero provider calls, then accepts a corrected same-IP request with 201 and one controlled provider call.

## 2026-07-12: Full-Name Matching Undercounted Safe Entity Aliases

Symptom: answers using a safe entity shorthand such as “海底捞” could fail to count as mentioning “海底捞西安门店服务”, while generic category terms could still match loose fact fragments.

Cause: brand mention used normalized full-string containment, while no-brand fact matching allowed weak generic terms.

Fix: derive safe aliases by removing city and generic suffixes, reject generic aliases, and require an entity alias or verified official model as a strong identity anchor.

Verification: six labeled cases cover full names, local aliases, unbranded recommendation, generic-only text, wrong primary models, and related-product mentions; all pass.

## 2026-07-12: Official Content Was Ambiguous And PageAudit Used Fridge-Specific Facts

Symptom: the homepage promised a fast “AI exposure risk” check without a stable GEO category or explicit exclusions. Features, FAQ, GEO evidence, and `llms.txt` were missing; sitemap coverage was incomplete; PageAudit requested `/privacy/` although the public file was `/privacy.html` and its discovery dictionary contained fridge-only terms.

Fix: add a single product definition and exclusion statement across public surfaces; add features, FAQ, evidence-boundary, machine-readable, sitemap, canonical, WebApplication, and FAQPage entries; switch PageAudit to the real privacy route and generic business facts.

Verification: the initially failing four-part content contract passes 4/4; the complete suite passes 63/63, PageAudit reports 8/8 ok, and both tested viewports have zero overflow and zero console errors/warnings.

## 2026-07-12: PageAudit Followed Untrusted URLs Without Network Or Body Guards

Symptom: PageAudit used direct `fetch` with automatic redirects and full-body reads. It did not reject private addresses, DNS changes, private redirect targets, wrong MIME, oversized responses or loops, and it recorded no content hash or freshness state.

Fix: add per-hop URL/DNS validation, manual redirects, private/reserved IPv4/IPv6 rejection, timeout and MIME checks, streaming byte limits, controlled dynamic-render injection, and provenance fields. Local integration fixtures require an explicit loopback-only environment allowlist.

Verification: G3 safety cases cover private literals/resolution, IPv4-mapped IPv6, DNS rebinding, private redirect, loop, MIME, size, timeout, static/dynamic paths and scope retention. Full regression passes 73/73.

## 2026-07-12: Health Overstated Readiness And Rate Limits Reset On Restart

Symptom: a configured provider was reported ready without cost-boundary or recent-success evidence; Tencent/Volcengine could sample while billing safety was unknown. Hourly and global counters lived only in process memory.

Fix: split health semantics, add time-bounded cost gates and zero-request fail-close, persist operational aggregates, and replace in-memory counters with an atomic single-instance limiter storing only hashed client identifiers.

Verification: cost-unknown and expired gates make zero provider requests; controlled restart keeps the 429 boundary while same-ID recovery still works; health exposes persisted latency/success aggregates without input text. Full regression passes 78/78.

## 2026-07-13: Production Smoke Loop Overwrote zsh Command Search Path

Symptom: the first local public-smoke loop reported `command not found: curl` for every route and sent no requests.

Cause: the loop variable was named `path`, which is a special zsh array tied to `PATH`.

Fix: renamed the variable to `route` and invoked `/usr/bin/curl` explicitly. The corrected smoke returned 200 for all required routes.

## 2026-07-13: Guessed Report Path Loaded The SPA Start Screen

Symptom: `/report/diag_mri2hznd_fg6z69` returned HTTP 200 but showed the start screen instead of the report.

Cause: the server correctly returned the SPA fallback, while the frontend's implemented share contract reads `?report=<id>`.

Fix: production visual acceptance used `/?report=diag_mri2hznd_fg6z69`. Both viewports loaded the real 54-point report with no overflow or console errors/warnings. No product code change was needed.

## 2026-07-13: Final Typecheck Was Started From The Repository Root

Symptom: one combined static-check command returned npm `ENOENT` for `/Users/qzt/Developer/geo-lab/package.json`.

Cause: `npm run typecheck` was invoked from the repository root, while the package root is `apps/ai-exposure-check-h5/`.

Fix: stopped after classifying the path error and reran the full validation once from the H5 package directory.

Verification: typecheck, 81/81 tests, build, release precheck, bundle secret scan, and `git diff --check` all passed from the correct directory.

## 2026-07-13: GitHub HTTPS Credentials Were Invalid During Final Sync

Symptom: `git fetch origin --prune` returned `could not read Username for https://github.com`; `gh auth status` reported the active token invalid.

Cause: the repository remote uses HTTPS and the local GitHub CLI credential is no longer valid.

Handling: created the verified local commit and deployed that exact build without claiming premature sync success. After the user authorized Codex to handle login, used GitHub CLI's official device flow; no token was pasted into commands, logs, or project files. The GitHub credential file reports mode 600.

Verification: `gh auth status` reports the intended account and HTTPS protocol; fetch reported `origin/main...main = 0/7`; `git push origin main` advanced `02f162e..b4c17e0`, and the new tag `ai-exposure-check-h5-20260713132053` was pushed successfully.

## 2026-07-13: Production Environment Cleanup Needed Separate Approval

Symptom: the attempt to back up production `.env` and remove five deprecated variable lines was rejected by the safety approval layer before execution.

Cause: editing a production credential environment file requires a separate explicit confirmation, even though the deployed code and project example no longer use those variables.

Handling: did not retry or use an indirect workaround. The old variable names remain in production `.env`, mode 600, but release `20260713132053` ignores them; health and the controlled report prove Hy3 and Doubao sample without the legacy gates.

Next verification: after separate user approval, create a mode 600 backup, remove only the five exact deprecated keys, restart the service, and recheck 4/4 health without printing values.

## 2026-07-13: WeChat Developer Console Could Not Be Controlled Directly

Symptom: the computer-control session stopped when opening the current WeChat developer-platform console URL, so Codex could not safely inspect or modify the logged-in account through browser automation.

Handling: did not retry the blocked route or use an indirect login/cookie path. The user supplied screenshots of interface permissions and basic account information; those screenshots were used only for read-only prerequisite verification.

Result: the account was confirmed as personal and not certified, with the JS interface security domain unset. Account-side JSSDK setup was paused by user decision; no credential or account configuration was changed. This is an external account prerequisite, not an H5 product-code failure.

## 2026-07-13: Sandbox Blocked Integration-Test Loopback Listener

Symptom: the first final `npm test` run passed 73 assertions but eight integration tests failed with `listen EPERM` on `127.0.0.1`.

Cause: the managed sandbox denied the temporary loopback listeners used by the fake provider and integration server; no product assertion failed.

Fix: reran the unchanged test suite in the approved local environment where loopback listening is permitted.

Verification: all 81/81 tests passed. Typecheck, release precheck 13/13, bundle secret scan, documentation secret-shape scan, and `git diff --check` also passed.

## 2026-07-14: Historical Server Name Was Not A Local SSH Alias

Symptom: the first read-only production check used `VM-0-3-ubuntu` and failed with hostname resolution error.

Cause: that value is the server hostname shown by systemd/journal output, while the actual local SSH config alias is `lighthouse-lab`.

Fix: inspected `~/.ssh/config`, switched to the configured alias, and did not guess or write the server IP into project files.

Verification: `lighthouse-lab` returned the current release, systemd state, health, environment-file permissions and server capacity; deployment and rollback preparation then completed through that alias.

## 2026-07-14: Raw Research Evidence Fails Generic Whitespace Check

Symptom: the final repository-wide `git diff --cached --check` reported trailing spaces and extra EOF lines in API answers, consumer answers, webpage extraction snapshots and generated report HTML.

Cause: those files preserve third-party/model output verbatim. Normalizing them would silently alter the raw evidence required by the measurement protocol.

Handling: kept raw evidence unchanged and ran strict diff checks only on authored code, workflow, decision, score and deployment files. The authored-file check passed. The staged-path secret-shape scan returned no matches.

Verification: typecheck, 92/92 tests, release precheck, 15-file browser bundle secret scan and authored-file diff check all passed. No production model call was made during closeout.

## 2026-07-15: Refresh Score Count-Up Created A False Cross-Surface Conflict

Symptom: the stable report, API, summary and exports showed 61, while a refresh screenshot captured 42/43 in the cover ring and the desktop preview simultaneously showed 61.

Cause: the cover number animated from 0 to the final score over 900ms. The screenshot captured an intermediate frame; there were not two persisted scores or two scoring algorithms.

Fix: added a shared report-presentation contract and rendered the final numeric score immediately. The decorative ring animation remains, while Markdown, HTML and evidence package now use the same presentation mapping.

Verification: the regression covers report presentation and all three exports; the complete suite passes 93/93. Local and production Playwright checks show 61 on initial load and refresh, with refresh history containing only 61 and no console errors or warnings.

## 2026-07-15: Sandbox Loopback And zsh PATH Caused Two Non-Product Validation Failures

Symptom: the first complete local test run had 10 integration failures with `listen EPERM` on `127.0.0.1`; the first public-smoke loop then reported `command not found: curl` before sending any request.

Cause: the managed sandbox blocked temporary loopback listeners. Separately, the smoke loop reused zsh's special `path` array name, which rewrote command lookup; this repeated the already documented shell pitfall.

Handling: reran the unchanged test suite in the approved local environment and invoked `/usr/bin/curl` explicitly for the public smoke. No product code was changed for either environment failure.

Verification: the unchanged suite passes 93/93, and all 16 public pages/report/evidence/export GET checks return 200. The release itself remained healthy throughout the corrected checks.
