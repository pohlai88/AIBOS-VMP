# CI Gate Configuration & Test Quality Policy

**Purpose:** Enforce test quality without blocking valid PRs due to known baseline debt.  
**Owner:** Engineering  
**Status:** Active (Phase 1)  
**Last Updated:** 2025-12-24

---

## Philosophy: Targeted Gates + No-Regression

We have **623 passing tests** and **133 known baseline failures**. Blocking all PRs until 100% green would halt development, but allowing regressions would erode quality.

**Solution:** Two-tier gate system:
1. **Hard Gate:** Critical paths must always pass (SOA stability, core adapters)
2. **Soft Gate:** No new failures vs. documented baseline

---

## Gate A: Hard Requirements (Must Pass)

### SOA Stability Gate (Critical Path)

**Rationale:** SOA reconciliation is mission-critical and recently stabilized. Any regression indicates broken contracts.

**Required Passing:**
```yaml
soa_stability_gate:
  tests:
    - tests/utils/soa-matching-engine.test.js      # 17 tests
    - tests/components/soa-recon.test.js           # 8 tests
    - tests/adapters/soa-adapter.test.js           # 33 tests (after cache fix)
  
  total_required: 58 tests passing
  allowed_failures: 0
  
  failure_action: Block PR
  override: Requires engineering lead approval
```

**Pre-merge Checklist:**
- [ ] All SOA tests green
- [ ] Pass 5 still opt-in (not enabled by default)
- [ ] Canonical invoice shape preserved (no DB-native keys in engine)
- [ ] Discrepancy enums used (not hardcoded strings)

---

### Core Adapter Gate (Data Layer)

**Rationale:** Adapter layer is the single source of truth for DB operations. Regressions cascade to all features.

**Required Passing:**
```yaml
core_adapter_gate:
  tests:
    - tests/adapters/supabase.test.js              # Core CRUD operations
  
  allowed_failures: 
    - "createMessage should create a message"      # Known: table schema mismatch
    # (Document specific known failures with tickets)
  
  failure_action: Block PR if NEW failures appear
  override: Requires tech lead approval + tracking ticket
```

---

## Gate B: Baseline Regression Prevention (Soft)

### No-New-Failures Gate

**Rationale:** Prevent quality erosion while burning down known debt.

**Implementation:**
```yaml
baseline_gate:
  baseline_file: TEST_BASELINE_2025_12_24.md
  current_failures: 133
  
  rules:
    - name: "No new failures"
      check: current_failure_count <= baseline_failure_count
      action: Block PR
    
    - name: "Encourage improvements"
      check: current_failure_count < baseline_failure_count
      action: Auto-approve (still needs code review)
  
  exemptions:
    - New test files (not in baseline)
    - Flaky test quarantine (document in PR)
```

**Workflow:**
1. PR author runs full suite: `pnpm vitest`
2. If failures ≤ 133: ✅ Baseline gate passes
3. If failures > 133: ❌ PR blocked until new failures fixed
4. If failures < 133: 🎉 Celebrate improvement, update baseline

---

## Gate C: Code Quality (Always Active)

### Linting & Type Safety

**Required Passing:**
```yaml
quality_gate:
  checks:
    - npm run guardrails           # ESLint rules (skips SOA/ops as designed)
    - npm run type-check           # TypeScript (if applicable)
    - npm run format-check         # Prettier
  
  failure_action: Block PR (no exceptions)
```

**Note:** Guardrails explicitly skips `src/routes/soa/` and internal ops routes. SOA quality is enforced via **Gate A** instead.

---

## Test Categorization (For Prioritization)

### P0: Must Always Pass (Gate A)
- SOA matching engine
- SOA reconciliation components
- Core adapters (after schema cache fix)

### P1: Fix Within Sprint (Tracked)
- Schema evolution gaps (~19 failures)
- Missing required fields (tenant_id, company_id)

### P2: Fix Within 2 Sprints (Tracked)
- Test isolation issues (~30 failures)
- Cleanup hook gaps

### P3: Fix Opportunistically (Debt)
- Mock harness updates (~80 failures)
- Template name changes

---

## GitHub Actions Configuration

### Recommended Workflow

```yaml
name: PR Quality Gate

on:
  pull_request:
    branches: [main, master]

jobs:
  soa-stability:
    name: "Gate A: SOA Stability"
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      
      # Critical: Reset Supabase schema cache
      - name: Reset Supabase
        run: |
          supabase stop || true
          supabase start
      
      # Hard gate: Must pass
      - name: SOA Tests
        run: |
          pnpm vitest run tests/utils/soa-matching-engine.test.js
          pnpm vitest run tests/components/soa-recon.test.js
          pnpm vitest run tests/adapters/soa-adapter.test.js
  
  baseline-regression:
    name: "Gate B: No New Failures"
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      
      - name: Run Full Suite
        id: tests
        run: |
          pnpm vitest > test-output.txt 2>&1 || true
          FAILURES=$(grep -oP '\d+(?= failed)' test-output.txt | head -1)
          echo "failures=$FAILURES" >> $GITHUB_OUTPUT
      
      - name: Check Baseline
        run: |
          BASELINE=133
          CURRENT=${{ steps.tests.outputs.failures }}
          if [ "$CURRENT" -gt "$BASELINE" ]; then
            echo "❌ New failures detected: $CURRENT (baseline: $BASELINE)"
            exit 1
          elif [ "$CURRENT" -lt "$BASELINE" ]; then
            echo "🎉 Improved! Failures reduced: $CURRENT (was: $BASELINE)"
          else
            echo "✅ No new failures"
          fi
  
  code-quality:
    name: "Gate C: Linting"
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run guardrails
```

---

## Local Development Workflow

### Before Creating PR

```powershell
# 1. Reset environment
supabase db reset

# 2. Run SOA stability tests (must be green)
pnpm vitest run tests/utils/soa-matching-engine.test.js tests/components/soa-recon.test.js tests/adapters/soa-adapter.test.js

# 3. Run full suite and check baseline
pnpm vitest > .dev/test-output.txt 2>&1
# Check: Did failures increase beyond 133?

# 4. Run linting
npm run guardrails

# 5. If all gates pass → create PR
```

---

## Baseline Evolution Process

### When to Update Baseline

**Update baseline file (`TEST_BASELINE_2025_12_24.md`) when:**
1. ✅ PR intentionally fixes failures (new baseline < old baseline)
2. ✅ New tests added (not in old baseline)
3. ❌ Never update to **increase** allowed failures

### Update Process

```powershell
# 1. Generate new baseline
pnpm vitest > TEST_OUTPUT.txt 2>&1

# 2. Extract failure summary
# (Copy failure list to new baseline file)

# 3. Update gate configuration
# Edit .github/workflows/pr-quality.yml
# Set new baseline count

# 4. Commit with explanation
git add TEST_BASELINE_*.md .github/workflows/
git commit -m "Update test baseline: reduced failures from 133 to X"
```

---

## Exemption & Override Policy

### When Overrides Are Allowed

**Scenario 1: Flaky Test Quarantine**
- Test fails intermittently (race condition, timing)
- **Action:** Mark test as `.skip()`, file tracking ticket, merge PR
- **Requirement:** Must have ticket + timeline to fix

**Scenario 2: Known Infrastructure Issue**
- Supabase schema cache stale (not PR's fault)
- **Action:** Document in PR, restart Supabase, re-run tests
- **Requirement:** Verify other tests still pass after reset

**Scenario 3: Emergency Hotfix**
- Production incident requires immediate fix
- **Action:** Engineering lead can override gates
- **Requirement:** Follow-up PR to fix tests within 24 hours

### Override Request Template

```markdown
## Gate Override Request

**Gate Failed:** [Gate A / Gate B / Gate C]
**Reason:** [Flaky test / Infrastructure / Hotfix]
**Justification:** [Why this PR must merge despite failure]

**Mitigation:**
- [ ] Tracking ticket created: #[issue number]
- [ ] Timeline to fix: [date]
- [ ] Approver: @[engineering lead]
```

---

## Metrics & Monitoring

### Weekly Quality Report

Track these metrics:
- **SOA stability:** Should be 100% (58/58 green)
- **Baseline failures:** Target -10 per sprint
- **New test coverage:** Tests added vs features added
- **Flaky test rate:** Quarantined tests / total tests

### Dashboard (Recommended)

```yaml
Current Status (2025-12-24):
  SOA Stability: ✅ 54/58 (93%) — 4 failures = cache issue
  Baseline: 133 failures (known debt)
  
Target (Sprint End):
  SOA Stability: ✅ 58/58 (100%)
  Baseline: ≤ 120 failures (-10% reduction)
  
Long-term Goal (Q1 2026):
  Full Suite: 100% green
  No baseline exemptions
```

---

## FAQ

### Q: PR has 134 failures (baseline is 133). Can it merge?

**A:** No. Either:
1. Fix the 1 new failure, OR
2. Request override with justification + tracking ticket

### Q: PR fixes 5 failures (now 128 total). What happens?

**A:** 🎉 Auto-approve on baseline gate! Still needs code review.  
Update baseline file to reflect new count.

### Q: SOA tests fail due to schema cache. Can I merge?

**A:** No. Run `supabase db reset`, re-run tests. If still failing, there's a real regression.

### Q: Guardrails skips SOA routes. How is SOA quality enforced?

**A:** Via **Gate A** (SOA stability tests). Guardrails focuses on general code style; SOA has domain-specific contracts enforced by tests.

---

## Related Documentation

- **SOA Contracts:** `docs/development/SOA_MATCHING_RULES.md`
- **Test Reset Guide:** `docs/development/TEST_ENVIRONMENT_RESET.md`
- **Failure Classification:** `TEST_FAILURE_CLASSIFICATION.md`
- **QA Process:** `docs/QA_VERIFICATION_PROCESS.md`

---

## Change Log

- **2025-12-24:** Initial gate policy after SOA stabilization
  - Gate A: SOA stability (58 tests)
  - Gate B: Baseline ≤ 133 failures
  - Gate C: Guardrails (linting)
