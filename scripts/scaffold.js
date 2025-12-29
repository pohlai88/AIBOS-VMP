#!/usr/bin/env node

/**
 * Scaffold Script
 * 
 * Automatically generates files from templates by replacing placeholders.
 * 
 * Usage:
 *   node scripts/scaffold.js <EntityName> <table_name>
 * 
 * Example:
 *   node scripts/scaffold.js Invoice invoices
 * 
 * This creates:
 *   - src/services/invoice.service.js
 *   - src/app/api/invoice/route.js
 *   - migrations/052_create_invoices.sql (manual - prompts user)
 *   - tests/unit/invoice.service.test.js (manual - prompts user)
 * 
 * @module scripts/scaffold
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ============================================================================
// CONFIGURATION
// ============================================================================

const TEMPLATES_DIR = path.join(__dirname, '../src/templates');
const OUTPUT_DIRS = {
  service: path.join(__dirname, '../src/services'),
  route: path.join(__dirname, '../src/routes'),
  migration: path.join(__dirname, '../migrations'),
  test: path.join(__dirname, '../tests/unit'),
};

const TEMPLATE_FILES = {
  service: 'service.template.js',
  routePage: 'route.page.template.js',
  routeApi: 'route.api.template.js',
  migration: 'migration.template.sql',
  test: 'test.template.js',
};

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Replace placeholders in template content
 */
function replacePlaceholders(content, entityName, tableName, domain, idColumn = 'id', hasDeletedBy = true) {
  const entityNameLower = entityName.toLowerCase();
  const entityNameKebab = entityNameLower.replace(/([A-Z])/g, '-$1').toLowerCase();
  const date = new Date().toISOString().split('T')[0];

  return content
    .replace(/\{\{EntityName\}\}/g, entityName) // Invoice
    .replace(/\{\{entity-name\}\}/g, entityNameKebab) // invoice
    .replace(/\{\{table_name\}\}/g, tableName) // invoices
    .replace(/\{\{id_column\}\}/g, idColumn) // id | case_id | payment_id
    .replace(/\{\{has_deleted_by\}\}/g, hasDeletedBy.toString()) // true | false
    .replace(/\{\{Domain\}\}/g, domain) // finance
    .replace(/\{\{Date\}\}/g, date) // 2025-01-22
    .replace(/\{\{Description\}\}/g, `${entityName} entity`)
    .replace(/\{\{EntityDescription\}\}/g, entityName.toLowerCase());
}

/**
 * Ensure directory exists
 */
function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`📁 Created directory: ${dirPath}`);
  }
}

/**
 * Get next migration number
 */
function getNextMigrationNumber() {
  const migrationsDir = OUTPUT_DIRS.migration;
  if (!fs.existsSync(migrationsDir)) {
    return '052';
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.match(/^\d+_.*\.sql$/))
    .map(f => parseInt(f.split('_')[0]))
    .filter(n => !isNaN(n))
    .sort((a, b) => b - a);

  const nextNum = files.length > 0 ? files[0] + 1 : 52;
  return String(nextNum).padStart(3, '0');
}

/**
 * Prompt user for input
 */
function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

async function scaffold() {
  // Parse arguments
  const args = process.argv.slice(2);
  const [domain, entityName, tableName, idColumn] = args;

  // Validation
  if (!entityName || !tableName) {
    console.error('❌ Error: Missing required arguments');
    console.log('\nUsage:');
    console.log('  node scripts/scaffold.js <domain> <EntityName> <table_name> [id_column]');
    console.log('\nExample:');
    console.log('  node scripts/scaffold.js finance Invoice invoices id');
    console.log('  node scripts/scaffold.js client Case nexus_cases case_id');
    console.log('  node scripts/scaffold.js finance Payment nexus_payments payment_id');
    console.log('\nDomains: finance | vendor | client | compliance | system');
    console.log('\nid_column: Primary key column name (default: "id")');
    console.log('  - Standard tables: "id"');
    console.log('  - Nexus tables: "case_id", "payment_id", "invoice_id", "user_id", "tenant_id", etc.');
    process.exit(1);
  }

  // Validate domain
  const validDomains = ['finance', 'vendor', 'client', 'compliance', 'system'];
  if (!domain || !validDomains.includes(domain.toLowerCase())) {
    console.error(`❌ Error: Invalid domain. Must be one of: ${validDomains.join(', ')}`);
    process.exit(1);
  }

  const normalizedDomain = domain.toLowerCase();
  const normalizedIdColumn = idColumn || 'id'; // Default to 'id' if not provided
  
  // Check if table is CRUD-S capable (from registry)
  // Note: This is a dynamic import to avoid circular dependencies
  let hasDeletedBy = true; // Default to true for new entities
  try {
    // Use dynamic import with file:// protocol for ES modules
    const adapterPath = path.resolve(__dirname, '../src/adapters/nexus-adapter.js');
    const { getSoftDeleteConfig } = await import(`file://${adapterPath}`);
    const crudSConfig = getSoftDeleteConfig(tableName);
    if (crudSConfig) {
      hasDeletedBy = crudSConfig.hasDeletedBy;
      console.log(`ℹ️  Table '${tableName}' is CRUD-S capable (hasDeletedBy: ${hasDeletedBy})`);
    } else {
      console.log(`⚠️  Table '${tableName}' is NOT in CRUD-S registry. Soft delete/restore routes will be generated but will fail at runtime.`);
      console.log(`   Add to SOFT_DELETE_CAPABLE registry in nexus-adapter.js if this is a business entity.`);
    }
  } catch (error) {
    console.warn(`⚠️  Could not check CRUD-S registry: ${error.message}`);
    console.warn(`   Defaulting to hasDeletedBy: true`);
  }

  // Validate entity name format
  if (!/^[A-Z][a-zA-Z0-9]*$/.test(entityName)) {
    console.error('❌ Error: EntityName must be PascalCase (e.g., Invoice, UserProfile)');
    process.exit(1);
  }

  // Validate table name format
  if (!/^[a-z][a-z0-9_]*$/.test(tableName)) {
    console.error('❌ Error: table_name must be snake_case (e.g., invoices, user_profiles)');
    process.exit(1);
  }

  console.log(`\n🚀 Scaffolding ${entityName} entity (Domain: ${normalizedDomain})...\n`);

  // ============================================================================
  // GENERATE FILES
  // ============================================================================

  const generatedFiles = [];

  // 1. Service File
  try {
    const templatePath = path.join(TEMPLATES_DIR, TEMPLATE_FILES.service);
    if (!fs.existsSync(templatePath)) {
      console.error(`❌ Template not found: ${templatePath}`);
      process.exit(1);
    }

    const templateContent = fs.readFileSync(templatePath, 'utf8');
    const serviceContent = replacePlaceholders(templateContent, entityName, tableName, normalizedDomain, normalizedIdColumn, hasDeletedBy);
    
    ensureDirectory(OUTPUT_DIRS.service);
    const servicePath = path.join(OUTPUT_DIRS.service, `${tableName}.service.js`);
    
    if (fs.existsSync(servicePath)) {
      const overwrite = await prompt(`⚠️  File exists: ${servicePath}\n   Overwrite? (y/N): `);
      if (overwrite.toLowerCase() !== 'y') {
        console.log(`⏭️  Skipped: ${servicePath}`);
      } else {
        fs.writeFileSync(servicePath, serviceContent);
        console.log(`✅ Created: ${servicePath}`);
        generatedFiles.push(servicePath);
      }
    } else {
      fs.writeFileSync(servicePath, serviceContent);
      console.log(`✅ Created: ${servicePath}`);
      generatedFiles.push(servicePath);
    }
  } catch (error) {
    console.error(`❌ Error generating service file: ${error.message}`);
  }

  // 2. Route Page File (SSR)
  try {
    const templatePath = path.join(TEMPLATES_DIR, TEMPLATE_FILES.routePage);
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    const routeContent = replacePlaceholders(templateContent, entityName, tableName, normalizedDomain, normalizedIdColumn, hasDeletedBy);
    
    ensureDirectory(OUTPUT_DIRS.route);
    const routePath = path.join(OUTPUT_DIRS.route, `${tableName}.js`);
    
    if (fs.existsSync(routePath)) {
      const overwrite = await prompt(`⚠️  File exists: ${routePath}\n   Overwrite? (y/N): `);
      if (overwrite.toLowerCase() !== 'y') {
        console.log(`⏭️  Skipped: ${routePath}`);
      } else {
        fs.writeFileSync(routePath, routeContent);
        console.log(`✅ Created: ${routePath}`);
        generatedFiles.push(routePath);
      }
    } else {
      fs.writeFileSync(routePath, routeContent);
      console.log(`✅ Created: ${routePath}`);
      generatedFiles.push(routePath);
    }
  } catch (error) {
    console.error(`❌ Error generating route page file: ${error.message}`);
  }

  // 2b. Route API File (JSON API)
  try {
    const templatePath = path.join(TEMPLATES_DIR, TEMPLATE_FILES.routeApi);
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    const routeContent = replacePlaceholders(templateContent, entityName, tableName, normalizedDomain, normalizedIdColumn, hasDeletedBy);
    
    ensureDirectory(OUTPUT_DIRS.route);
    const routeApiPath = path.join(OUTPUT_DIRS.route, `${tableName}-api.js`);
    
    if (fs.existsSync(routeApiPath)) {
      const overwrite = await prompt(`⚠️  File exists: ${routeApiPath}\n   Overwrite? (y/N): `);
      if (overwrite.toLowerCase() !== 'y') {
        console.log(`⏭️  Skipped: ${routeApiPath}`);
      } else {
        fs.writeFileSync(routeApiPath, routeContent);
        console.log(`✅ Created: ${routeApiPath}`);
        generatedFiles.push(routeApiPath);
      }
    } else {
      const createApi = await prompt(`\n📝 Create API route file? (Y/n): `);
      if (createApi.toLowerCase() !== 'n') {
        fs.writeFileSync(routeApiPath, routeContent);
        console.log(`✅ Created: ${routeApiPath}`);
        generatedFiles.push(routeApiPath);
      }
    }
  } catch (error) {
    console.error(`❌ Error generating route API file: ${error.message}`);
  }

  // 3. Migration File (Manual - prompts user)
  try {
    const templatePath = path.join(TEMPLATES_DIR, TEMPLATE_FILES.migration);
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    const migrationContent = replacePlaceholders(templateContent, entityName, tableName, normalizedDomain, normalizedIdColumn, hasDeletedBy);
    
    const migrationNum = getNextMigrationNumber();
    const migrationPath = path.join(OUTPUT_DIRS.migration, `${migrationNum}_create_${tableName}.sql`);
    
    if (fs.existsSync(migrationPath)) {
      console.log(`⏭️  Migration file exists: ${migrationPath}`);
      console.log(`   Please create migration manually or use different number`);
    } else {
      const createMigration = await prompt(`\n📝 Create migration file? (Y/n): `);
      if (createMigration.toLowerCase() !== 'n') {
        ensureDirectory(OUTPUT_DIRS.migration);
        fs.writeFileSync(migrationPath, migrationContent);
        console.log(`✅ Created: ${migrationPath}`);
        generatedFiles.push(migrationPath);
        console.log(`   ⚠️  Remember to customize fields in the migration!`);
      }
    }
  } catch (error) {
    console.error(`❌ Error generating migration file: ${error.message}`);
  }

  // 4. Test File (Manual - prompts user)
  try {
    const templatePath = path.join(TEMPLATES_DIR, TEMPLATE_FILES.test);
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    const testContent = replacePlaceholders(templateContent, entityName, tableName, normalizedDomain, normalizedIdColumn, hasDeletedBy);
    
    ensureDirectory(OUTPUT_DIRS.test);
    const testPath = path.join(OUTPUT_DIRS.test, `${tableName}.service.test.js`);
    
    if (fs.existsSync(testPath)) {
      const overwrite = await prompt(`⚠️  File exists: ${testPath}\n   Overwrite? (y/N): `);
      if (overwrite.toLowerCase() !== 'y') {
        console.log(`⏭️  Skipped: ${testPath}`);
      } else {
        fs.writeFileSync(testPath, testContent);
        console.log(`✅ Created: ${testPath}`);
        generatedFiles.push(testPath);
      }
    } else {
      const createTest = await prompt(`\n🧪 Create test file? (Y/n): `);
      if (createTest.toLowerCase() !== 'n') {
        fs.writeFileSync(testPath, testContent);
        console.log(`✅ Created: ${testPath}`);
        generatedFiles.push(testPath);
      }
    }
  } catch (error) {
    console.error(`❌ Error generating test file: ${error.message}`);
  }

  // ============================================================================
  // SUMMARY
  // ============================================================================

  console.log(`\n✨ Scaffolding complete!`);
  console.log(`\n📋 Generated ${generatedFiles.length} file(s):`);
  generatedFiles.forEach(file => {
    console.log(`   - ${file}`);
  });

  console.log(`\n📝 Next Steps:`);
  console.log(`   1. Review generated files and customize as needed`);
  console.log(`   2. Replace all placeholders ({{EntityName}}, {{entity-name}}, {{table_name}})`);
  console.log(`   3. Add entity-specific fields to migration`);
  console.log(`   4. Add business logic methods to service`);
  console.log(`   5. Customize validation schema in routes`);
  console.log(`   6. Mount routes in server.js:`);
  console.log(`      - app.use('/${tableName}', ${entityName}Router);`);
  console.log(`      - app.use('/api/${tableName}', ${entityName}ApiRouter);`);
  console.log(`   7. Add test cases`);
  console.log(`   8. Run migration in Supabase SQL Editor`);
  console.log(`   9. Test the implementation\n`);
}

// ============================================================================
// EXECUTE
// ============================================================================

if (require.main === module) {
  scaffold().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { scaffold, replacePlaceholders };

