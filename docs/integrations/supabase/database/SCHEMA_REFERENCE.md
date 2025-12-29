# Schema Reference: Governance Snapshot

**Version:** 1.0.0  
**Last Updated:** 2025-01-22  
**Status:** Active  
**Purpose:** Database schema reference (implementation detail, not the design itself)  
**Auto-Generated:** Yes (via `scripts/generate-schema-docs.mjs`)

---

## ⚠️ Important: This is NOT the Source of Truth

> **"The Map vs. The Territory"** - This document is the **map** (implementation detail), not the **territory** (business reality).

### What This Document Is

- ✅ **Governance Snapshot** - Current database structure (what currently exists)
- ✅ **Implementation Detail** - How the domain model is stored
- ✅ **Optimization Layer** - Indexes, constraints, performance optimizations
- ✅ **Current State** - Documentation of what is, not how to design

### What This Document Is NOT

- ❌ **Source of Truth** - The domain model is the source of truth (see [Domain Modeling](./DOMAIN_MODELING.md))
- ❌ **Design Document** - The design is in the domain model, not the schema
- ❌ **Business Logic** - Business rules are in the domain model
- ❌ **Prescriptive Guide** - Doesn't tell you how to design, documents what exists

### Documentation Philosophy

This document asks: **"What currently exists?"** not **"How should you design?"**

- The domain model tells you **how to design** (business entities, relationships)
- The storage strategy tells you **how to store** (SQL vs. JSONB decision)
- This document tells you **what exists** (current schema state)

---

## 📋 Table of Contents

1. [Schema Overview](#schema-overview)
2. [Table Definitions](#table-definitions)
3. [Indexes](#indexes)
4. [Constraints](#constraints)
5. [Relationships](#relationships)
6. [Related Documentation](#related-documentation)

---

## 🏗️ Schema Overview

> **Note:** This section will be auto-generated from the live database using `mcp_supabase_list_tables`.

**Status:** Schema reference generation pending. Run `node scripts/generate-schema-docs.mjs` to generate.

---

## 📊 Table Definitions

> **Note:** This section will be auto-generated from the live database.

**Status:** Table definitions pending. Run `node scripts/generate-schema-docs.mjs` to generate.

---

## 🔍 Indexes

> **Note:** This section will be auto-generated from the live database.

**Status:** Index definitions pending. Run `node scripts/generate-schema-docs.mjs` to generate.

---

## 🔒 Constraints

> **Note:** This section will be auto-generated from the live database.

**Status:** Constraint definitions pending. Run `node scripts/generate-schema-docs.mjs` to generate.

---

## 🔗 Relationships

> **Note:** This section will be auto-generated from the live database.

**Status:** Relationship definitions pending. Run `node scripts/generate-schema-docs.mjs` to generate.

---

## 📚 Related Documentation

- [Domain Modeling](./DOMAIN_MODELING.md) - **START HERE** - Business entities (the abstract concept)
- [Flexible Data Patterns](./FLEXIBLE_DATA_PATTERNS.md) - JSONB vs. columns decision framework
- [Evolutionary Design](../best-practices/EVOLUTIONARY_DESIGN.md) - How to evolve schemas without breaking apps
- [RLS Policies](./RLS_POLICIES.md) - Row Level Security implementation
- [Indexes and Performance](./INDEXES_AND_PERFORMANCE.md) - Performance optimization

---

## 🔄 Auto-Generation

This document is auto-generated from the live database. To regenerate:

```bash
node scripts/generate-schema-docs.mjs
```

The script will:
1. Query live database using `mcp_supabase_list_tables`
2. Generate table definitions with columns, types, constraints
3. Generate index definitions
4. Generate relationship diagrams
5. Update this document

**Frequency:** On-demand or scheduled (weekly recommended)

---

**Last Updated:** 2025-01-22  
**Next Auto-Generation:** Run script to generate

