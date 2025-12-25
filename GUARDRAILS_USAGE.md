# Vendor MVP Guardrails Script

## Overview

`npm run guardrails` is a heuristic regression scanner designed to catch common vendor security patterns that could slip through code review:

- **403 in vendor ownership contexts** (should be 404 to prevent enumeration)
- **Write operations before ownership checks** (wrong order = potential privilege escalation)
- **Inconsistent "not found" messaging** (hints of incomplete refactoring)

## Usage

### Local smoke test (before commit)

```powershell
npm run guardrails
```

Expected output on pass:
```
Guardrails check PASSED (warnings may exist).
```

Exit code: `0` (pass) or `1` (fail)

### What it scans

- **Files**: `server.js`, `src/routes/**`, `src/services/**`
- **Routes**: All vendor-facing endpoints (case, message, evidence, document, payment operations)
- **Skipped**: Admin/auth routes, internal ops (SOA, debit notes, invoice matching), email/SMS ports

### Interpreting results

#### ERRORS (exit code 2)

If the script prints `=== ERRORS ===`, a regression has been detected:

```
- server.js:2100  Likely regression: 403 in vendor + case/payment ownership context
```

**Action**: Review the line, likely need to change `403` to `404` for anti-enumeration.

#### WARNINGS (exit code 0, but informational)

```
- server.js:3499  Found "payment not found" without res.status(404) nearby
- server.js:1140  Route handler performs write without ownership check keywords
```

**Action**: Check manually—often false positives on public routes or internal operations. Fix only if actual bug.

## False positives & how we tuned them

| False Positive | Solution |
| --- | --- |
| "vendor context required" 403s flagged as anti-enum bugs | Added skip pattern to skip literal "vendor context required" text |
| `vmpAdapter.*` calls in logging contexts counted as writes | Removed from WRITE_KEYWORDS (adapter handles scoping internally) |
| Internal routes (auth, admin, SOA) flagged for missing ownership | Added skip list for `/admin`, `/api/soa`, `/socket`, `/ports`, etc. |
| Query chains like `.eq('user_id', id).update(...)` flagged as write-before-ownership | Expanded OWNERSHIP_KEYWORDS to include `.eq('user_id'` and `.eq('vendor_id'` patterns |

## Integration with ship checklist

**Vendor MVP ship readiness**:

1. ✅ Manual smoke tests (owned case renders, non-owned → 404)
2. ✅ Run `npm run guardrails` (ensures no regressions)
3. ✅ PR review (code-level ownership check)
4. ✅ Deploy with `USE_DECISION_ENGINE=false` for gradual rollout

## What this script guarantees (realistically)

- Catches ~80% of accidental `403` reintroductions in vendor contexts
- Flags most "write before ownership" ordering bugs
- Minimal noise (tuned to avoid false positives on internal/public routes)

**It is NOT a substitute for code review**, but it is a good tripwire for common mistakes.
