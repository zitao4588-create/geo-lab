# Thread Synthesis

This note summarizes how all materials in this conversation should be used together.

## 1. 黄小木 GEO 入门文章

Use it as the beginner-facing explanation:

- GEO is about making AI systems find, understand, cite, and recommend a product.
- Website/content basics still matter.
- Independent pages, structured content, FAQ, comparison pages, robots/sitemap/schema, and optional `llms.txt` are hygiene factors.

Boundary:

- Do not treat any single technical file or page structure as a guaranteed AI ranking mechanism.
- Keep claims conservative.

## 2. 苍何 GEO 诊断产品文章

Use it as product-format evidence:

- The marketable first product is a diagnosis report, not just a writing service.
- Useful report modules include score, visibility, infrastructure, competitor analysis, mention rate, sentiment, and roadmap.
- The commercial narrative is `先诊断，再治疗`.

Boundary:

- Reports must separate measured evidence from model inference.

## 3. GEOFlow

Use it as a later-stage reference system:

- It points toward content production, distribution, RAG/semantic chunking, WordPress/agent publishing, and workflow orchestration.
- It is too heavy for the first build.

Boundary:

- Do not start by deploying or rewriting GEOFlow.
- Extract concepts and contracts before borrowing architecture.

## 4. Fridge Radar Sample Report

Use it as the first local case and UI/data-shape sample:

- It proves a 9-section GEO diagnosis report can be packaged as JSON + HTML.
- It gives a concrete report structure and scoring narrative.

Boundary:

- The sample contains virtual/simulated sources and had no populated `search-cache` evidence during inspection.
- A commercial version must store raw query/answer/page evidence.

## 5. 姚金刚 GEO Materials

Use this batch as the method backbone:

- Global GEO content engineering system.
- Single content/page GEO method.
- Prompt Universe.
- Evidence atom library.
- Selection vs absorption measurement.
- Skill-based workflow packaging.

Boundary:

- Respect open-source licenses and attribution.
- Treat public prompts/skills as references to adapt, not blind copy/paste product claims.

## Combined Direction

The project should evolve in this order:

1. Knowledge base and templates.
2. Manual diagnosis report workflow.
3. GEO diagnosis agent.
4. GEO content refiner agent.
5. GEO monitoring agent.
6. Optional content production/distribution system.

The first business-facing deliverable should be:

```text
brand-brief.yaml
prompt-universe.csv
diag-report.json
GEO-diagnosis-report.html
evidence/
roadmap.md
```

