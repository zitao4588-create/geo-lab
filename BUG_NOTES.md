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
