# Source notes

## Reporting job

- Audience: product stakeholders.
- Question: compare the latest four-model GEO diagnosis of 冰箱小雷达 with the earliest report, covering product GEO optimization and report professionalism/readability.
- Baseline: the earliest saved HTML/JSON report. Intermediate checkpoints: first evidence-disciplined H5 report and post-launch single-model report.
- Current window: one controlled production diagnosis generated on 2026-07-11.
- Success criterion: distinguish real improvement from score-model changes, identify the next GEO actions, and audit whether the report is commercially credible and readable.

## Evidence boundaries

- The earliest report's 41/100 score, 8-platform mention statistics, media items, and competitor counts were generated from explicitly virtual/simulated records. They describe a product concept and report shape, not measured AI exposure.
- The 61, 68, and 71 scores use later scoring logic; the 41-to-71 change is not a like-for-like KPI delta.
- The current four providers use standard model APIs without a web-search or citation tool. Their answers measure this API response snapshot, not current consumer-app search results or live-web retrieval.
- The current report's `mentionedBrand` flag is a literal brand-string check. Manual review separately classifies correct entity recognition and unprompted discovery.
- Report-quality ratings are an expert audit on a 0-5 rubric, not product telemetry.

## Manual recognition audit

- Prompted brand/feature/comparison samples: 20/20 contain the string `冰箱小雷达`, but 0/20 correctly identify the target as the saved微信小程序 product.
- Unprompted category/persona/risk/GEO samples: 0/20 mention `冰箱小雷达`.
- DeepSeek and Hy3 mostly state uncertainty or infer a generic smart-fridge device.
- Qwen repeatedly interprets the name as hardware or millimetre-wave radar.
- Doubao confidently describes an appliance radar feature and, in the competitor answer, attributes both names to美菱; this is a high-confidence entity error.
- Doubao also interprets GEO as geographic optimization in the generic GEO question, showing acronym ambiguity in the prompt contract.

## Report-quality rubric

- Evidence integrity: whether headline claims are supported by real, inspectable evidence.
- Method transparency: whether scope, denominator, model/provider, scoring, and limitations are clear.
- Professional completeness: whether the report has a coherent diagnosis, evidence, priorities, exports, and audit trail.
- Readability: whether the report can be skimmed without duplication, awkward labels, or raw implementation language.
- Actionability: whether recommendations point to specific evidence gaps and measurable next checks.

Ratings:

| Dimension | Earliest | Current | Rationale |
| --- | ---: | ---: | --- |
| Evidence integrity | 1.5 | 4.2 | Virtual rows were visibly labeled in the earliest report; the current report uses real APIs, URL checks and saved evidence, but overstates literal mentions. |
| Method transparency | 2.0 | 3.5 | The current report shows providers, counts, weights and caveats, but does not separate prompted recall from unprompted discovery and does not foreground the no-web-search limitation. |
| Professional completeness | 4.0 | 4.2 | Both are structurally rich; the current version adds exports and an evidence package, but its visible excerpts omit Qwen and Doubao. |
| Readability | 3.6 | 3.8 | The current report is shorter and better prioritized, but repeats provider-level prompts, uses long audience strings, and exposes technical provider codes. |
| Actionability | 3.5 | 4.0 | The current roadmap is more grounded in live pages, though recommendations remain generic and are not mapped to exact model errors. |

## Chart map

1. `score_evolution`: discrete bar comparison of four report checkpoints. Supports the claim that reported scores rose while methodology changed. Single blue root; zero baseline; caveat immediately adjacent.
2. `scenario_coverage`: horizontal comparison of current scenario mention rates. Supports the finding that only explicitly branded prompt classes produce string mentions. Single blue root; rates shown as percentages; sample counts retained.
3. `report_quality`: grouped bar comparison of expert 0-5 ratings for the earliest and current report. Supports the conclusion that evidence integrity improved most while methodology/readability still need work. Two-root cap with earliest as neutral/context and current as blue/focal.

## Executive structure mapping

- Title: report title block.
- Executive Summary: dedicated second markdown block.
- Key findings with visual evidence: score evolution, scenario coverage/provider table, and report-quality comparison.
- Recommended next steps: GEO and report-product action table.
- Further questions: measurement questions that affect the next product decision.
- Caveats and assumptions: final visible section.
