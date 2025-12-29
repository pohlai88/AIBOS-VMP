# Documentation Registry

**Version:** 1.0.0  
**Last Updated:** 2025-12-28  
**Purpose:** Central registry of all documentation files with metadata and naming convention compliance  
**Status:** Active

---

## Registry Purpose

This registry provides:
- **Complete inventory** of all documentation files
- **Naming convention compliance** tracking
- **Metadata** for each document (version, status, purpose)
- **Quick reference** for finding documentation
- **Control mechanism** for documentation standards

---

## Naming Convention Rules

### File Naming Standard

**Format:** `CATEGORY_SPECIFIC_NAME[_VERSION][_STATUS].md`

**Components:**
1. **CATEGORY** - Uppercase prefix indicating document type (optional for some)
2. **SPECIFIC_NAME** - Descriptive name in SCREAMING_SNAKE_CASE
3. **VERSION** - Optional version number (e.g., `_V2`)
4. **STATUS** - Optional status indicator (e.g., `_DRAFT`, `_DEPRECATED`)

**Examples:**
- ✅ `AI_ASSISTANT_CONSISTENCY_PROTOCOL.md`
- ✅ `DESIGN_SYSTEM_V2_PRODUCTION_READY.md`
- ✅ `SUPABASE_MCP_SETUP.md`
- ❌ `design-system.md` (not SCREAMING_SNAKE_CASE)
- ❌ `figma.md` (not descriptive)

### Directory Naming Standard

**Format:** `kebab-case` (lowercase with hyphens)

**Examples:**
- ✅ `design-system/`
- ✅ `error-handling/`
- ✅ `workflows/`
- ❌ `DesignSystem/` (PascalCase)
- ❌ `design_system/` (snake_case)

---

## Document Categories

### Architecture (`docs/architecture/`)
- System architecture documents
- Technical decisions
- Database schemas
- API specifications

### Design System (`docs/design-system/`)
- Design system specifications
- Component patterns
- Utility class references
- Design audits

### Development (`docs/development/`)
- **workflows/** - Development workflows and processes
- **guides/** - Setup and usage guides
- **policies/** - Development policies and standards
- **error-handling/** - Error handling patterns and guides
- **prds/** - Product Requirements Documents (PRDs) for easy developer follow-up

### Integrations (`docs/integrations/`)
- **supabase/** - Supabase integration guides
- **mcp/** - MCP (Model Context Protocol) setup
- **services/** - Other service integrations

### SSOT (`docs/ssot/`)
- **db/** - Database guardrail matrices and registries (operational SSOT)

---

## Registry Entries

### Architecture Documents

| File | Path | Version | Status | Last Updated | Purpose |
|------|------|---------|--------|--------------|---------|
| ARCHITECTURE_ASSESSMENT_AND_RECOMMENDATIONS.md | `docs/architecture/` | 2.0.0 | Active | 2025-12-28 | Clean stack definition and migration path |
| DATABASE_STANDARDS.md | `docs/architecture/` | 1.0.0 | Active | 2025-01-22 | Source of truth for Supabase database design and best practices |
| METADATA_CONTROL_PROTOCOL.md | `docs/architecture/` | 1.0.0 | Active | 2025-01-22 | Metadata-driven architecture governance framework |
| METADATA_IMPLEMENTATION_GUIDE.md | `docs/architecture/` | 1.0.0 | Active | 2025-01-22 | Step-by-step implementation guide for metadata-driven architecture |
| METADATA_QUICK_REFERENCE.md | `docs/architecture/` | 1.0.0 | Active | 2025-01-22 | Quick reference card for metadata-driven architecture |
| METADATA_DOCUMENTATION_SUMMARY.md | `docs/architecture/` | 1.0.0 | Active | 2025-01-22 | Navigation guide to all metadata documentation |
| ENTERPRISE_IMPLEMENTATION_GUIDE.md | `docs/architecture/` | - | Active | - | Enterprise implementation patterns |
| RLS_ENFORCEMENT_COMPLETE_ARCHITECTURE.md | `docs/architecture/` | - | Active | - | Row Level Security architecture |
| SOFT_DELETE_CRUD_S_ARCHITECTURE.md | `docs/architecture/` | 1.0.0 | Active | 2025-01-22 | Foundational ERP pattern for soft delete (CRUD-S) with database-level enforcement |
| SOFT_DELETE_IMPLEMENTATION_GUIDE.md | `docs/architecture/` | 1.0.0 | Active | 2025-01-22 | Step-by-step implementation guide for CRUD-S pattern |
| SOFT_DELETE_QUICK_REFERENCE.md | `docs/architecture/` | 1.0.0 | Active | 2025-01-22 | One-page quick reference card for CRUD-S pattern |
| TEMPLATE_PATTERN_GUIDE.md | `docs/architecture/` | 1.0.0 | Active | 2025-01-22 | Comprehensive guide to Template Pattern for sustainability |
| APPLICATION_TEMPLATE_SYSTEM.md | `docs/architecture/` | 1.0.0 | Active | 2025-01-22 | Operational templates that enforce security and sustainability (CRUD-S, RLS, validation) |
| APPLICATION_TEMPLATE_QUICK_START.md | `docs/architecture/` | 1.0.0 | Active | 2025-01-22 | One-page quick start guide for application templates |
| TEMPLATE_SYSTEM_SUMMARY.md | `docs/architecture/` | 1.0.0 | Active | 2025-01-22 | Complete overview of all template systems (view + application) |
| TEMPLATE_CONSTITUTION.md | `docs/architecture/` | 1.1.0 | Active | 2025-01-22 | System-grade template doctrine with governance, contracts, and non-negotiables |
| TESTING_STRATEGY.md | `docs/architecture/` | 3.0.0 | Active | 2025-12-28 | Testing philosophy, patterns, and anti-patterns |

### Design System Documents

| File | Path | Version | Status | Last Updated | Purpose |
|------|------|---------|--------|--------------|---------|
| COMPONENT_PATTERNS_LIBRARY.md | `docs/design-system/` | - | Active | - | Component pattern reference |
| DESIGN_SYSTEM_V2_PRODUCTION_READY.md | `docs/design-system/` | 2.0.0 | Active | - | Production-ready design system |
| UTILITY_CLASSES_REFERENCE.md | `docs/design-system/` | - | Active | - | Utility class documentation |

#### Design System Contracts (`docs/design-system/contracts/`)

| File | Path | Version | Status | Last Updated | Purpose |
|------|------|---------|--------|--------------|---------|
| CONTRACT_001_DESIGN_SYSTEM.md | `docs/design-system/contracts/` | - | Active | - | Design system contract |
| CONTRACT_002_ICON_PLACEMENT.md | `docs/design-system/contracts/` | - | Active | - | Icon placement contract |

#### Design System Assets (`docs/design-system/assets/`)

| File | Path | Type | Status | Purpose |
|------|------|------|--------|---------|
| NexusIconAdaptive.svg | `docs/design-system/assets/` | SVG | Active | Nexus adaptive icon |
| NexusIconObicle.svg | `docs/design-system/assets/` | SVG | Active | Nexus obicle icon |
| NexusIconWord.svg | `docs/design-system/assets/` | SVG | Active | Nexus word icon |
| Obicle NexusCanon Empty Background.svg | `docs/design-system/assets/` | SVG | Active | Obicle NexusCanon logo |

### Development Documents

#### Workflows (`docs/development/workflows/`)

| File | Path | Version | Status | Last Updated | Purpose |
|------|------|---------|--------|--------------|---------|
| AI_ASSISTANT_CONSISTENCY_PROTOCOL.md | `docs/development/workflows/` | 1.1.0 | Active | 2025-12-28 | AI assistant consistency framework |

#### Development Root (`docs/development/`)

| File | Path | Version | Status | Last Updated | Purpose |
|------|------|---------|--------|--------------|---------|
| AI_VIOLATION_TRACKER.md | `docs/development/` | 1.0.0 | Active | 2025-12-28 | Violation tracking system |

#### Development Notes (`docs/development/notes/`)

| File | Path | Version | Status | Last Updated | Purpose |
|------|------|---------|--------|--------------|---------|
| NEXUS_GLOBALCONFIG.md | `docs/development/notes/` | - | Active | - | Nexus global configuration |
| CCP_VALIDATION_REPORT.md | `docs/development/notes/` | - | Active | - | CCP validation report |
| CCP7_AUTH_INTEGRATION_PLAN.md | `docs/development/notes/` | - | Active | - | Auth integration plan |
| FILESYSTEM_MCP_ANALYSIS.md | `docs/development/notes/` | - | Active | - | Filesystem MCP analysis |
| ROOT_CLEANLINESS_EVIDENCE.md | `docs/development/notes/` | - | Active | - | Root cleanliness evidence |
| ROOT_COMPLIANCE_ANALYSIS.md | `docs/development/notes/` | - | Active | - | Root compliance analysis |
| VALIDATED_GITHUB_REPO_COMPARISON.md | `docs/development/notes/` | - | Active | - | GitHub repo comparison |
| CONFIG_AUDIT_REPORT.md | `docs/development/notes/` | 1.0.0 | Active | 2025-12-28 | Configuration files audit report |

#### Guides (`docs/development/guides/`)

| File | Path | Version | Status | Last Updated | Purpose |
|------|------|---------|--------|--------------|---------|
| CURSOR_CAPABILITIES_EXPLANATION.md | `docs/development/guides/` | - | Active | - | Cursor IDE capabilities |
| DEPLOYMENT_GUIDE.md | `docs/development/guides/` | - | Active | - | Deployment instructions |
| TESTING_GUIDE.md | `docs/development/guides/` | 1.0.0 | **Deprecated** | 2025-12-28 | Old testing guide (use v3.0) |
| TESTING_GUIDE_V3.md | `docs/development/guides/` | 3.0.0 | Active | 2025-12-28 | Comprehensive testing guide |
| TESTING_GUIDE_MIGRATION_REPORT.md | `docs/development/guides/` | - | Active | 2025-12-28 | Migration from v1.0 to v3.0 |
| TESTING_GUIDE_APPLICATION_SUMMARY.md | `docs/development/guides/` | - | Active | 2025-12-28 | Application summary and compliance |
| TESTS_DIRECTORY_RESTRUCTURE_PROPOSAL.md | `docs/development/guides/` | - | Active | 2025-12-28 | Test directory restructure proposal |
| TESTS_RESTRUCTURE_COMPLIANCE_REPORT.md | `docs/development/guides/` | - | Active | 2025-12-28 | Restructure compliance tracking |
| TEST_RESTRUCTURE_STATUS.md | `docs/development/guides/` | 3.0.0 | Active | 2025-12-28 | Final status and completion |
| TEST_RESTRUCTURE_COMPLETE.md | `docs/development/guides/` | 3.0.0 | Active | 2025-12-28 | Completion summary |
| TEST_STRUCTURE_COMPLETION_REPORT.md | `docs/development/guides/` | - | Active | 2025-12-28 | Structure completion details |
| TEST_STRUCTURE_FINAL_REPORT.md | `docs/development/guides/` | - | Active | 2025-12-28 | Final completion report |
| TEST_BASELINE_ANALYSIS.md | `docs/development/guides/` | - | Active | 2025-12-28 | Test baseline analysis |
| REMAINING_WORK.md | `docs/development/guides/` | - | Active | 2025-12-28 | Optional enhancements and remaining work |
| PHASE_0_PATH_ALIASES_VERIFICATION.md | `docs/development/guides/` | - | Active | 2025-12-28 | Path aliases verification |
| COPILOT_INSTRUCTIONS.md | `docs/development/guides/` | - | Active | 2025-12-28 | GitHub Copilot instructions |

### Test Documentation (`tests/`)

| File | Path | Version | Status | Last Updated | Purpose |
|------|------|---------|--------|--------------|---------|
| TEST_REGISTRY.md | `tests/` | 1.0.0 | Active | 2025-12-28 | Central registry of all test files |
| TEST_STANDARDS.md | `tests/` | 1.0.0 | Active | 2025-12-28 | Test standards and rules |

#### Policies (`docs/development/policies/`)

| File | Path | Version | Status | Last Updated | Purpose |
|------|------|---------|--------|--------------|---------|
| CI_GATE_POLICY.md | `docs/development/policies/` | - | Active | - | CI/CD gate policies |
| DOCUMENTATION_CONTROL.md | `docs/development/policies/` | 1.0.0 | Active | 2025-12-28 | Documentation control mechanisms |

#### Error Handling (`docs/development/error-handling/`)

| File | Path | Version | Status | Last Updated | Purpose |
|------|------|---------|--------|--------------|---------|
| ERROR_HANDLING.md | `docs/development/error-handling/` | - | Active | - | Error handling patterns |
| NEXUS_CIRCUIT_BREAKER_GUIDE.md | `docs/development/error-handling/` | - | Active | - | Circuit breaker implementation |
| NEXUS_ERROR_HANDLING_PLAYBOOK.md | `docs/development/error-handling/` | - | Active | - | Error handling playbook |

#### PRDs (`docs/development/prds/`)

| File | Path | Version | Status | Last Updated | Purpose |
|------|------|---------|--------|--------------|---------|
| PRD_DB_SCHEMA.md | `docs/development/prds/` | 1.1.0 | Active | 2025-01-22 | Official PRD for flexible database and super flexible schema architecture |
| PRD_FIXES_APPLIED.md | `docs/development/prds/` | - | Active | - | PRD fixes and applied changes documentation |

### Integration Documents

#### Supabase (`docs/integrations/supabase/`)

| File | Path | Version | Status | Last Updated | Purpose |
|------|------|---------|--------|--------------|---------|
| SUPABASE_DOCUMENTATION_MASTER_PLAN.md | `docs/integrations/supabase/` | 1.1.0 | Active | 2025-01-22 | Comprehensive Supabase documentation system architecture |
| SUPABASE_DOCS_PLANNING_SUMMARY.md | `docs/integrations/supabase/` | 1.0.0 | Active | 2025-01-22 | Quick reference for Supabase documentation planning |
| SUPABASE_PLATFORM_CAPABILITIES.md | `docs/integrations/supabase/` | 1.0.0 | Active | 2025-01-22 | Complete guide to Supabase platform capabilities |
| REALTIME_GUIDE.md | `docs/integrations/supabase/` | 1.0.0 | Active | 2025-01-22 | Comprehensive Realtime guide - subscriptions, presence, broadcasting |
| STORAGE_GUIDE.md | `docs/integrations/supabase/` | 1.0.0 | Active | 2025-01-22 | Complete Storage guide - file uploads, image transformations, RLS |
| AUTHENTICATION_GUIDE.md | `docs/integrations/supabase/` | 1.0.0 | Active | 2025-01-22 | Complete Authentication guide - all auth methods, MFA, OAuth |
| AI_VECTORS_GUIDE.md | `docs/integrations/supabase/` | 1.0.0 | Active | 2025-01-22 | Complete AI & Vectors guide - pgvector, embeddings, semantic search |
| DATABASE_BRANCHING_GUIDE.md | `docs/integrations/supabase/` | 1.0.0 | Active | 2025-01-22 | Complete Database Branching guide - Git-like database development |
| CRON_JOBS_GUIDE.md | `docs/integrations/supabase/` | 1.0.0 | Active | 2025-01-22 | Complete Cron Jobs guide - scheduled SQL functions with pg_cron |
| QUEUES_GUIDE.md | `docs/integrations/supabase/` | 1.0.0 | Active | 2025-01-22 | Complete Queues guide - reliable message queuing with pgmq |
| MANAGEMENT_API_GUIDE.md | `docs/integrations/supabase/` | 1.0.0 | Active | 2025-01-22 | Complete Management API guide - programmatic project management |
| IMPLEMENTATION_PLAN_AI_VECTORS.md | `docs/integrations/supabase/` | 1.0.0 | Planning | 2025-01-22 | Complete implementation plan for AI Vectors semantic search |
| SUPABASE_AUDIT_AND_OPTIMIZATION.md | `docs/integrations/supabase/` | 1.0.0 | Active | 2025-01-22 | Comprehensive audit and optimization roadmap for Supabase PaaS |
| OPTIMIZATION_ACTION_PLAN.md | `docs/integrations/supabase/` | 1.0.0 | Active | 2025-01-22 | Prioritized action plan with checklists for optimization implementation |
| PERFORMANCE_OPTIMIZATION_GUIDE.md | `docs/integrations/supabase/` | 1.0.0 | Active | 2025-01-22 | Actionable performance optimization strategies and fixes |
| SECURITY_HARDENING_GUIDE.md | `docs/integrations/supabase/` | 1.0.0 | Active | 2025-01-22 | Security fixes and hardening recommendations based on audit |
| SUPABASE_MCP_GUIDE.md | `docs/integrations/supabase/` | - | Active | - | Supabase MCP integration |
| SUPABASE_MCP_QUICK_START.md | `docs/integrations/supabase/` | - | Active | - | Quick start guide |
| SUPABASE_MCP_SETUP.md | `docs/integrations/supabase/` | - | Active | - | Setup instructions |
| EDGE_FUNCTIONS_SECRETS_GUIDE.md | `docs/integrations/supabase/` | - | Active | - | Edge functions secrets |

#### Supabase Database (`docs/integrations/supabase/database/`)

| File | Path | Version | Status | Last Updated | Purpose |
|------|------|---------|--------|--------------|---------|
| DOMAIN_MODELING.md | `docs/integrations/supabase/database/` | 1.0.0 | Active | 2025-01-22 | Business entities & interactions (the abstract concept) |
| FLEXIBLE_DATA_PATTERNS.md | `docs/integrations/supabase/database/` | 1.0.0 | Active | 2025-01-22 | JSONB vs. columns decision framework (Anti-Trap Guide) |
| SCHEMA_REFERENCE.md | `docs/integrations/supabase/database/` | 1.0.0 | Active | 2025-01-22 | Database schema (implementation detail, auto-generated) |

#### Supabase Best Practices (`docs/integrations/supabase/best-practices/`)

| File | Path | Version | Status | Last Updated | Purpose |
|------|------|---------|--------|--------------|---------|
| EVOLUTIONARY_DESIGN.md | `docs/integrations/supabase/best-practices/` | 1.0.0 | Active | 2025-01-22 | How to refactor DBs without breaking apps (Schemaless → Strict) |

#### MCP (`docs/integrations/mcp/`)

| File | Path | Version | Status | Last Updated | Purpose |
|------|------|---------|--------|--------------|---------|
| MCP_SETUP.md | `docs/integrations/mcp/` | - | Active | - | MCP setup guide |

#### Services (`docs/integrations/services/`)

| File | Path | Version | Status | Last Updated | Purpose |
|------|------|---------|--------|--------------|---------|
| EMAIL_CONFIGURATION.md | `docs/integrations/services/` | - | Active | - | Email service configuration |
| OLLAMA_SETUP.md | `docs/integrations/services/` | - | Active | - | Ollama setup |
| PUSH_NOTIFICATIONS_SETUP.md | `docs/integrations/services/` | - | Active | - | Push notifications setup |

---

## Compliance Tracking

### Naming Convention Compliance

**Total Files:** 34  
**Compliant:** 34 (100%)  
**Non-Compliant:** 0

### Directory Structure Compliance

**Total Directories:** 10  
**Compliant (kebab-case):** 10 (100%)  
**Non-Compliant:** 0

---

## Control Mechanisms

### 1. Registry Validation

All new documentation files must:
- Be registered in this file
- Follow naming convention
- Include metadata (version, status, purpose)
- Be placed in correct directory

### 2. Naming Convention Enforcement

**Rules:**
- Files: `SCREAMING_SNAKE_CASE.md`
- Directories: `kebab-case/`
- No spaces, no special characters (except `_` and `-`)
- Descriptive names (not generic)

### 3. Directory Control

**Allowed Directories:**
- `docs/architecture/`
- `docs/design-system/`
- `docs/development/` (with subdirectories)
- `docs/integrations/` (with service subdirectories)

**Forbidden:**
- Creating new top-level directories without approval
- Files directly in `docs/` (except DOCUMENTATION_STANDARDS.md, DOCUMENTATION_REGISTRY.md, README.md)

---

## Maintenance

### When Adding New Documentation

1. **Check Registry** - Ensure no duplicate exists
2. **Follow Naming Convention** - Use SCREAMING_SNAKE_CASE
3. **Place in Correct Directory** - Use appropriate subdirectory
4. **Update Registry** - Add entry to this file
5. **Include Metadata** - Version, status, purpose, date

### When Updating Documentation

1. **Update Last Updated** date in registry
2. **Update Version** if significant changes
3. **Update Status** if deprecated/archived

### When Removing Documentation

1. **Archive** to `archive/` directory
2. **Mark as Deprecated** in registry
3. **Update Status** to "Archived"

---

## Quick Reference

### Find Documentation By Category

**Architecture:**
- System design → `docs/architecture/`
- Technical decisions → `docs/architecture/`

**Design:**
- Component patterns → `docs/design-system/COMPONENT_PATTERNS_LIBRARY.md`
- Design system → `docs/design-system/DESIGN_SYSTEM_V2_PRODUCTION_READY.md`

**Development:**
- Workflows → `docs/development/workflows/`
- Guides → `docs/development/guides/`
- Policies → `docs/development/policies/`
- Error handling → `docs/development/error-handling/`

**Integrations:**
- Supabase → `docs/integrations/supabase/`
- MCP → `docs/integrations/mcp/`
- Other services → `docs/integrations/services/`

### SSOT Documents (`docs/ssot/db/`)

| File | Path | Version | Status | Last Updated | Purpose |
|------|------|---------|--------|--------------|---------|
| DB_GUARDRAIL_MATRIX.md | `docs/ssot/db/` | 1.0.0 | Active | 2025-01-22 | Master SSOT guardrail matrix (Table, JSONB Contract, Promotion, RLS, Drift Checks) |
| JSONB_CONTRACT_REGISTRY.md | `docs/ssot/db/` | 1.0.0 | Active | 2025-01-22 | Detailed JSONB contract definitions with Zod schemas |
| PROMOTION_LOG.md | `docs/ssot/db/` | 1.0.0 | Active | 2025-01-22 | Historical log of JSONB → Column promotions (Phase A/B/C) |
| RLS_COVERAGE.md | `docs/ssot/db/` | 1.0.0 | Active | 2025-01-22 | Detailed RLS policy definitions for all tenant-scoped tables |

---

### Product & Feature Documents (`docs/`)

| File | Path | Version | Status | Last Updated | Purpose |
|------|------|---------|--------|--------------|---------|
| VENDOR_PORTAL_FEATURE_ANALYSIS.md | `docs/` | 1.0.0 | Active | 2025-01-22 | Comprehensive feature analysis for Vendor Portal (Essential, Good-to-Have, Silent Killer features) |
| VENDOR_MANAGEMENT_ADVANCED_FEATURES.md | `docs/` | 1.0.0 | Active | 2025-01-22 | Advanced vendor management features: Cryptographic audit trail, Vendor evaluation, Break-glass escalation, Vendor lifecycle management |
| CRYPTOGRAPHIC_IMPLEMENTATIONS_AUDIT.md | `docs/` | 1.0.0 | Active | 2025-01-22 | Comprehensive audit of all cryptographic implementations in the codebase |
| FINAL_PRD_WITH_CCP_CONTROL.md | `docs/` | 1.0.0 | Active | 2025-01-22 | Final PRD with CCP control, tech stack definition, MCP utilization, entry points, scope (IN/OUT), DoD, KPIs |

---

**Registry Last Updated:** 2025-01-22  
**Total Documents:** 38  
**Compliance:** 100%

