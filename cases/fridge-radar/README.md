# Fridge Radar GEO Diagnosis Case

This case stores the GEO diagnosis output generated for the local fridge-radar project.

## Source Artifacts

- HTML report copy: `../../sources/local-artifacts/fridge-radar/冰箱小雷达-GEO诊断报告.html`
- JSON report copy: `../../sources/local-artifacts/fridge-radar/冰箱小雷达冰箱食材库存管理小程序-diag-report.json`

Original local paths:

- `/Users/qzt/Developer/projects/fridge-app/diag-output/冰箱小雷达-GEO诊断报告.html`
- `/Users/qzt/Developer/projects/fridge-app/diag-output/冰箱小雷达冰箱食材库存管理小程序-diag-report.json`

## Observed Structure

The JSON report uses these major stages:

- `OVERVIEW`
- `AIVO_SCORE`
- `USER_PROFILE`
- `AI_SEARCH`
- `INFRA_EVAL`
- `COMPETITOR`
- `GEO_EFFECT`
- `SENTIMENT`
- `SUGGESTION`

## Important Lesson

The sample report is useful as a product format, but it has an evidence problem:

- It uses virtual/simulated source entries in places.
- The original `search-cache` folder was empty when inspected.
- Therefore, it should be treated as a delivery/UI sample, not a fully auditable measurement sample.

For GEO Lab, the improved commercial version should always output:

- `diag-report.json`
- `GEO-diagnosis-report.html`
- `evidence/queries/`
- `evidence/answers/`
- `evidence/pages/`
- `evidence/screenshots-or-html/` when available
- `evidence/source-map.md`

## Reusable Report Modules

This sample validates a 9-section client-facing report shape:

1. Diagnosis overview
2. Composite score
3. User profile and query scenarios
4. AI search visibility
5. Infrastructure evaluation
6. Competitor analysis
7. Inclusion/mention effect
8. Sentiment and risk
9. Recommendations and roadmap

