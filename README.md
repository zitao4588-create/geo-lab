# GEO Lab

GEO Lab is a local, ChatGPT-readable knowledge and project workspace for learning GEO, building a reusable GEO diagnosis/content-engineering workflow, and turning the workflow into sellable deliverables.

This project is source-first:

- `sources/` stores extracted, copied, or raw materials.
- `knowledge/` stores synthesized notes and operating methods.
- `templates/` stores reusable input/output templates.
- `cases/` stores case studies such as fridge-radar.
- `agents/` is reserved for future agent specs or implementations.
- `outputs/` is reserved for generated reports and experiments.

## ChatGPT Reading Order

When using ChatGPT or Codex to analyze this project, read in this order:

1. `README.md`
2. `PROJECT_CONTEXT.md`
3. `sources/source-index.md`
4. `knowledge/methods/geo-method-map.md`
5. `knowledge/product/geo-project-roadmap.md`
6. `cases/fridge-radar/README.md`
7. Raw files under `sources/` only when deeper evidence is needed.

## Core Direction

The current goal is not to clone GEOFlow as a heavy CMS. The first practical product should be a lightweight GEO diagnosis and content-engineering system:

1. Collect brand/product facts.
2. Build a Prompt Universe.
3. Run or simulate AI visibility checks with explicit evidence labels.
4. Audit website/content/authority infrastructure.
5. Generate `diag-report.json`, `GEO diagnosis report.html`, and an `evidence/` folder.
6. Convert findings into page/content/monitoring actions.

## Evidence Labels

Use these labels in every analysis:

- `raw_source`: directly extracted from a saved source file.
- `verified_external`: checked against a current official, primary, or authoritative source.
- `model_inference`: inferred from available materials, not directly verified.
- `suggested_supplement`: useful but missing source, data口径, original quote, or supporting evidence.

## Current Source Snapshot

The initial snapshot includes:

- 4 X/Twitter posts/articles saved as JSON and Markdown.
- 7 GEO documents/papers/demos extracted as Markdown.
- GitHub README/metadata/registry/key skill files from Yao GEO resources.
- The fridge-radar GEO diagnosis HTML and JSON sample.

See `sources/source-index.md` for the full list.

