# Vendor MVP Shipping Guide

This document summarizes the vendor-facing endpoints and expected behaviors for the MVP release.

## Entry Points

- Dashboard: `http://localhost:9000${BASE_PATH}/vendor/dashboard`
- Vendor partials (HTMX): `${BASE_PATH}/vendor/partials/...`

## Vendor Partials

All vendor partials enforce authentication and vendor ownership before rendering:
- `case-inbox.html`
- `case-detail.html`
- `case-thread.html`
- `case-activity.html`
- `case-checklist.html`
- `case-evidence.html`
- `escalation.html`
- `case-row.html`

## Side-Effect Actions

All vendor actions enforce authentication and vendor ownership before performing writes:
- `POST /cases/:id/messages`
- `POST /cases/:id/evidence`
- `POST /cases/:id/documents`

## Deny Behavior (Anti-enumeration)

- Not authenticated: `401` or redirect to login
- Authenticated but not a vendor member: `403`
- Authenticated vendor, case not owned: `404`

Notes:
- `404` is preferred when a vendor attempts to access a case they do not own to avoid case ID enumeration.

## Decision Engine Rollout

- Controlled via `USE_DECISION_ENGINE` environment flag.
- Recommended setting for production at launch: `USE_DECISION_ENGINE=false`.
- Enable in staging first; ensure ownership checks remain enforced before any status mutations.

## QA Checklist

**Automated Regression Scan**:
- Run `npm run guardrails` before final deployment
- Verify exit code `0` (no errors, only warnings acceptable)
- See `GUARDRAILS_USAGE.md` for interpreting results

**Manual Smoke Tests**:
- Navigate to `${BASE_PATH}/vendor/dashboard` and verify inbox loads.
- Load each partial for an owned case; verify content renders.
- Attempt to access a non-owned case; verify `404` behavior for partials and POST actions.
- Upload evidence/documents on an owned case; verify refresh.
- Post a message; verify thread refresh.

## Future Work (Post-MVP)

- Migrate vendor routes into `src/routes/vendor.js` for structural cleanliness.
- Wire leak tests with real fixtures and unskip.
- Expand decision engine to event-first with audit trails.
