# GEO Project Roadmap

## Positioning

Build a lightweight GEO diagnosis and content-engineering toolkit before attempting a full GEOFlow-style system.

The immediate business offer:

- GEO visibility diagnosis
- GEO content/page repair plan
- GEO monitoring report

## V0: Knowledge Base And Manual Delivery

Goal: produce reliable client reports manually with strong evidence boundaries.

Deliverables:

- Source library
- Prompt Universe template
- Evidence atom template
- Diagnosis report schema
- HTML report sample
- One fridge-radar case study

Success criteria:

- A user can hand ChatGPT the project and ask it to explain GEO, inspect sources, or draft a diagnosis.
- A future agent has clear input/output contracts.

## V1: Local Diagnosis Agent

Goal: automate report assembly without database or SaaS.

Input:

- `brand-brief.yaml`
- website URL or local product materials
- competitors
- target platforms
- target user intents

Output:

- `diag-report.json`
- `GEO-diagnosis-report.md`
- optional `GEO-diagnosis-report.html`
- `evidence/`

Modules:

1. Brand fact collector
2. Prompt Universe builder
3. Page/infrastructure auditor
4. AI visibility sampler or simulator
5. Competitor analyzer
6. Scoring engine
7. Recommendation generator
8. Report renderer

## V2: Content Refiner Agent

Goal: turn existing articles/pages into GEO-friendly assets.

Inputs:

- article/page content
- target prompts
- evidence sources
- desired output channel

Outputs:

- rewritten article/page
- before/after score
- change notes
- supplement list
- risk notes

Rules:

- Preserve original claims.
- Mark unsupported additions as `suggested_supplement`.
- Never invent statistics, citations, or quotes.

## V3: Monitoring Agent

Goal: track whether changes improve AI visibility over time.

Metrics:

- mention rate
- citation rate
- absorption proxy
- competitor share
- sentiment/risk issues
- source freshness
- answer accuracy

Important constraint:

Repeated sampling is required. A single AI answer is not enough.

## Commercial Packaging

Starter packages:

- Basic diagnosis: 199-499 RMB
- Deep diagnosis: 999-2999 RMB
- Monthly monitoring: 499-1999 RMB/month
- Add-on content repair package: priced by page/article count

The strongest wedge is a report that is:

- easy for a client to understand,
- hard to fake because it includes evidence,
- clear about next actions,
- repeatable after 30/60/90 days.

