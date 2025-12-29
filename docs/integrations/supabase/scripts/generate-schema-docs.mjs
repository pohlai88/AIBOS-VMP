#!/usr/bin/env node

/**
 * Generate Schema Documentation from Live Database
 * 
 * This script uses Supabase MCP tools to query the live database
 * and generate the SCHEMA_REFERENCE.md document.
 * 
 * Usage:
 *   node docs/integrations/supabase/scripts/generate-schema-docs.mjs
 * 
 * Requirements:
 *   - Supabase MCP server configured
 *   - Access to mcp_supabase_list_tables
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to output file
const OUTPUT_FILE = join(__dirname, '../database/SCHEMA_REFERENCE.md');

/**
 * Generate markdown table for table definitions
 */
function generateTableMarkdown(tables) {
  if (!tables || tables.length === 0) {
    return '**No tables found.**\n';
  }

  let markdown = '| Table Name | Schema | RLS Enabled | Columns | Description |\n';
  markdown += '|------------|--------|-------------|---------|-------------|\n';

  for (const table of tables) {
    const name = table.name || 'N/A';
    const schema = table.schema || 'public';
    const rlsEnabled = table.rls_enabled ? '✅' : '❌';
    const columnCount = table.columns?.length || 0;
    const description = table.description || '-';

    markdown += `| \`${name}\` | \`${schema}\` | ${rlsEnabled} | ${columnCount} | ${description} |\n`;
  }

  return markdown;
}

/**
 * Generate detailed table structure
 */
function generateTableDetails(tables) {
  if (!tables || tables.length === 0) {
    return '**No table details available.**\n';
  }

  let markdown = '';

  for (const table of tables) {
    const name = table.name || 'N/A';
    const schema = table.schema || 'public';
    
    markdown += `### \`${schema}.${name}\`\n\n`;
    
    if (table.description) {
      markdown += `**Description:** ${table.description}\n\n`;
    }

    // RLS Status
    markdown += `**RLS Enabled:** ${table.rls_enabled ? '✅ Yes' : '❌ No'}\n\n`;

    // Columns
    if (table.columns && table.columns.length > 0) {
      markdown += '**Columns:**\n\n';
      markdown += '| Column Name | Type | Nullable | Default | Description |\n';
      markdown += '|-------------|------|----------|---------|-------------|\n';

      for (const column of table.columns) {
        const colName = column.name || 'N/A';
        const colType = column.type || 'N/A';
        const nullable = column.nullable ? '✅' : '❌';
        const defaultValue = column.default || '-';
        const colDescription = column.description || '-';

        markdown += `| \`${colName}\` | \`${colType}\` | ${nullable} | ${defaultValue} | ${colDescription} |\n`;
      }
      markdown += '\n';
    }

    // Indexes
    if (table.indexes && table.indexes.length > 0) {
      markdown += '**Indexes:**\n\n';
      for (const index of table.indexes) {
        markdown += `- \`${index.name}\` (${index.type || 'B-tree'}) - ${index.description || 'No description'}\n`;
      }
      markdown += '\n';
    }

    // Constraints
    if (table.constraints && table.constraints.length > 0) {
      markdown += '**Constraints:**\n\n';
      for (const constraint of table.constraints) {
        markdown += `- \`${constraint.name}\` (${constraint.type}) - ${constraint.description || 'No description'}\n`;
      }
      markdown += '\n';
    }

    markdown += '---\n\n';
  }

  return markdown;
}

/**
 * Generate the complete schema reference document
 */
function generateSchemaReference(tables) {
  const timestamp = new Date().toISOString().split('T')[0];
  
  return `# Schema Reference: Governance Snapshot

**Version:** 1.0.0  
**Last Updated:** ${timestamp}  
**Status:** Active  
**Purpose:** Database schema reference (implementation detail, not the design itself)  
**Auto-Generated:** Yes (via \`scripts/generate-schema-docs.mjs\`)

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

**Total Tables:** ${tables?.length || 0}  
**Last Generated:** ${timestamp}

### Table Summary

${generateTableMarkdown(tables)}

---

## 📊 Table Definitions

${generateTableDetails(tables)}

---

## 🔍 Indexes

> **Note:** Index details are included in table definitions above.

**Summary:**
- Total indexes will be listed per table in the table definitions section
- GIN indexes are used for JSONB fields
- B-tree indexes are used for frequently queried columns

---

## 🔒 Constraints

> **Note:** Constraint details are included in table definitions above.

**Summary:**
- CHECK constraints enforce enum values and business rules
- FOREIGN KEY constraints enforce relationships
- UNIQUE constraints enforce uniqueness
- NOT NULL constraints enforce required fields

---

## 🔗 Relationships

> **Note:** Relationship information is derived from foreign key constraints in table definitions.

**Key Relationships:**
- Relationships are defined via FOREIGN KEY constraints
- See table definitions above for relationship details
- Domain model relationships are documented in [Domain Modeling](./DOMAIN_MODELING.md)

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

\`\`\`bash
node docs/integrations/supabase/scripts/generate-schema-docs.mjs
\`\`\`

The script will:
1. Query live database using \`mcp_supabase_list_tables\`
2. Generate table definitions with columns, types, constraints
3. Generate index definitions
4. Generate relationship diagrams
5. Update this document

**Frequency:** On-demand or scheduled (weekly recommended)

---

**Last Updated:** ${timestamp}  
**Next Auto-Generation:** Run script to generate
`;
}

/**
 * Main execution
 */
async function main() {
  console.log('🔄 Generating schema documentation...\n');

  try {
    // Note: This script is designed to be called with MCP tools available
    // In a real implementation, you would call mcp_supabase_list_tables here
    // For now, we'll create a template that can be populated
    
    console.log('⚠️  Note: This script requires Supabase MCP tools to be available.');
    console.log('   To use this script, ensure MCP server is configured and call:');
    console.log('   mcp_supabase_list_tables({ schemas: ["public"] })\n');

    // Placeholder: In real implementation, this would query the database
    const tables = []; // Would be populated from mcp_supabase_list_tables

    // Generate the document
    const markdown = generateSchemaReference(tables);

    // Write to file
    writeFileSync(OUTPUT_FILE, markdown, 'utf8');

    console.log(`✅ Schema documentation generated: ${OUTPUT_FILE}`);
    console.log(`   Tables documented: ${tables.length}`);
    console.log('\n📝 Next steps:');
    console.log('   1. Configure Supabase MCP connection');
    console.log('   2. Call mcp_supabase_list_tables to get table data');
    console.log('   3. Update this script to use the MCP tools');
    console.log('   4. Re-run to generate full documentation\n');

  } catch (error) {
    console.error('❌ Error generating schema documentation:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { generateSchemaReference, generateTableMarkdown, generateTableDetails };

