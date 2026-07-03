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
