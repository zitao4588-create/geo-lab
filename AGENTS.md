# GEO Lab Collaboration Rules

始终用中文沟通，除非用户明确要求英文。

## Project Nature

This is an independent GEO research and product workspace. It is not a production SaaS yet.

Default posture:

- Read source files before making claims.
- Prefer local saved files under `sources/` before browsing again.
- Distinguish raw source, verified fact, model inference, and suggested supplement.
- Do not overwrite raw source snapshots unless explicitly refreshing sources.
- Do not introduce database, login, payment, Docker, queue workers, or SaaS infrastructure unless the user explicitly asks.

## Before Editing

Before editing project files, state:

- which files will be edited,
- why those edits are needed,
- whether raw source files are affected.

Raw source files under `sources/` should normally be append-only or refreshed into a dated snapshot.

## Analysis Standard

When analyzing GEO materials:

- Do not treat GEO as a magic ranking hack.
- Prefer the workflow: diagnose -> optimize -> publish -> monitor.
- Treat claims about AI ranking, citation, or traffic uplift as uncertain unless measured.
- Preserve evidence boundaries: no fabricated media, citations, statistics, customer cases, or expert quotes.
- For commercial deliverables, always keep an `evidence/` folder or equivalent trace.

## Recommended First Steps

For a new ChatGPT/Codex session in this project:

1. Read `README.md`.
2. Read `PROJECT_CONTEXT.md`.
3. Read `sources/source-index.md`.
4. Read only the source files relevant to the task.

