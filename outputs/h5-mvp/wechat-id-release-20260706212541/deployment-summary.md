# WeChat ID Release 20260706212541

Date: 2026-07-06

Purpose: rebuild and deploy the H5 with the configured `VITE_CONSULT_WECHAT_ID` so the consultation modal can copy the WeChat ID text instead of only copying the generic add-WeChat instruction.

## Local Verification

- `npm run typecheck` passed.
- `npm run build` passed.
- Frontend bundle contains the configured WeChat ID text.
- Frontend bundle scan did not find `DEEPSEEK_API_KEY`, `api.deepseek.com`, or OpenAI-style `sk-...` key patterns.
- Server bundle still references DeepSeek environment variable names as code, not secret values.

## Deployment

- Release: `20260706212541`
- Previous release: `20260706165543`
- Target: `https://exposure.playgamelab.cn`
- Production dependencies installed with `npm ci --omit=dev`.
- Release precheck on port `8790` returned homepage `200` and `/api/health` with `samplingReady=true`.
- `current` now points to `releases/20260706212541`.
- `ai-exposure-check-h5.service` is `active`.

## Online Smoke

- Homepage returned `200`.
- `/api/health` returned `samplingReady=true`.
- Existing report page `?report=diag_mqzunocs_pzxoqe` returned `200`.
- Playwright verified the live consultation modal displays the configured WeChat ID.

## Evidence

- `online-consult-modal.png`

## Notes

- No new diagnosis was created in this smoke test to avoid consuming DeepSeek quota.
- The WeChat ID was configured via ignored environment file and build-time Vite injection; it was not committed to Git.
