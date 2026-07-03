# T8 P0 Release Compliance Review

Date: 2026-07-03
Release: `20260703201836`
Domain: `https://exposure.playgamelab.cn`

This is an engineering compliance review, not legal advice.

## Verified Online Display

- Homepage returns HTTP `200`.
- `/api/health` returns `samplingReady=true` and `model=deepseek-v4-pro`.
- The deployed bundle contains:
  - `陕ICP备2026012759号-2`
  - `陕公网安备61010202000523号`
  - `备案展示以 exposure 子域名最终核验为准`
- `privacy.html` states:
  - contact is optional,
  - contact is only for voluntary manual interpretation, complete diagnosis, or follow-up services,
  - H5 automatic initial diagnosis is currently free,
  - manual complete diagnosis, report interpretation, and page optimization require separately confirmed scope and pricing.
- `terms.html` states:
  - H5 automatic initial diagnosis is currently free,
  - manual complete diagnosis, report interpretation, content optimization, page changes, and monthly retests are outside the free initial check,
  - scope, delivery, pricing, cycle, and refund boundaries must be separately confirmed,
  - displayed备案 information comes from existing local `playgamelab.cn` records and `exposure.playgamelab.cn` still needs final subject/filing/charging review before public promotion.

## Local Filing Evidence

Local evidence from `/Users/qzt/Developer/轻量服务器/docs/DOMAIN_AND_ICP.md` records:

- Main filing domain: `playgamelab.cn`
- Website name: `今天你能熬过周一吗`
- Website access address: `https://monday.playgamelab.cn`
- ICP filing number: `陕ICP备2026012759号-2`
- Public security filing number: `陕公网安备61010202000523号`

This evidence supports that the filing numbers exist in local project records, but it does not prove that `exposure.playgamelab.cn` is already cleared as a public commercial AI diagnosis/consulting subdomain.

## Practical Review Result

Status: technical/internal testing can continue.

Public paid promotion should remain blocked until these are confirmed:

- Whether `exposure.playgamelab.cn` needs a new ICP service item, access address update, or access-provider备案 update.
- Whether the existing public security filing covers this subdomain and service use, or whether a new/changed公安备案 entry is required.
- Whether the current备案主体 is suitable for public promotion of AI exposure diagnosis, manual GEO consulting, content optimization, and monthly retest services.
- Whether paid service handoff needs formal quote, service scope, refund terms, invoice/tax handling, and customer data deletion process before any paid conversion.

## Current Safe Boundary

- The H5 automatic initial diagnosis remains free.
- The H5 does not include login, database, online payment, paid entitlement, contract flow, or admin backend.
- The UI can invite users to scan the QR code for manual consultation, but paid service scope and pricing must be confirmed outside the H5 before transaction.
- Keep the footer caveat visible until filing and subject review are complete.
