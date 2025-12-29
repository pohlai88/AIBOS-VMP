# Supabase Database Branching: Complete Guide

**Version:** 1.0.0  
**Last Updated:** 2025-01-22  
**Status:** Active  
**Purpose:** Comprehensive guide to Supabase Database Branching - Git-like database development  
**Auto-Generated:** No

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Creating Branches](#creating-branches)
3. [Branch Operations](#branch-operations)
4. [Merging Branches](#merging-branches)
5. [Use Cases](#use-cases)
6. [Best Practices](#best-practices)
7. [Related Documentation](#related-documentation)

---

## 🎯 Overview

### What is Database Branching?

Database Branching allows you to create **isolated database copies** for development, testing, and experimentation - just like Git branches for code.

### Key Features

- ✅ **Isolated Databases** - Each branch is a complete database copy
- ✅ **Migration Management** - Migrations apply to branches independently
- ✅ **Merge Support** - Merge branch changes to production
- ✅ **Rebase Support** - Apply production changes to branch
- ✅ **Reset Support** - Reset branch to specific migration
- ✅ **Cost Management** - Pay only for active branches

---

## 🌿 Creating Branches

### Create Branch via MCP

```javascript
// Create development branch
const { data, error } = await mcp_supabase_create_branch({
  name: "feature-new-auth",
  confirm_cost_id: costConfirmation.id
})

if (data) {
  console.log('Branch created:', data.branch_id)
  console.log('Project ref:', data.project_ref)
}
```

### Create Branch via Management API

```javascript
// Using Management API
const response = await fetch('https://api.supabase.com/v1/projects/{project_ref}/branches', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'feature-new-auth',
    git_branch: 'feature/new-auth'  // Optional: link to Git branch
  })
})
```

### Branch Naming

**Best Practices:**
- Use descriptive names: `feature-*`, `bugfix-*`, `experiment-*`
- Link to Git branches when possible
- Include ticket/issue numbers: `feature-123-new-auth`

---

## 🔄 Branch Operations

### List Branches

```javascript
// List all branches
const { data, error } = await mcp_supabase_list_branches()

if (data) {
  data.branches.forEach(branch => {
    console.log(`Branch: ${branch.name}`)
    console.log(`Status: ${branch.status}`)
    console.log(`Created: ${branch.created_at}`)
  })
}
```

### Branch Status

Branches have different statuses:
- `active` - Branch is ready to use
- `creating` - Branch is being created
- `merging` - Branch is being merged
- `rebasing` - Branch is being rebased
- `resetting` - Branch is being reset

### Delete Branch

```javascript
// Delete branch
const { data, error } = await mcp_supabase_delete_branch({
  branch_id: 'br_xxxxxxxxxxxxx'
})
```

---

## 🔀 Merging Branches

### Merge to Production

```javascript
// Merge branch to production
const { data, error } = await mcp_supabase_merge_branch({
  branch_id: 'br_xxxxxxxxxxxxx'
})

if (data) {
  console.log('Merge initiated:', data.status)
  // Status will be 'merging' until complete
}
```

### What Gets Merged

- ✅ **Migrations** - All migrations from branch
- ✅ **Edge Functions** - All Edge Functions from branch
- ✅ **Secrets** - Edge Function secrets
- ❌ **Data** - Production data is NOT merged

### Merge Process

1. **Validation** - Check for conflicts
2. **Migration Application** - Apply branch migrations to production
3. **Edge Function Deployment** - Deploy branch Edge Functions
4. **Verification** - Verify merge success

---

## 🔄 Rebasing Branches

### Rebase on Production

```javascript
// Rebase branch on production
const { data, error } = await mcp_supabase_rebase_branch({
  branch_id: 'br_xxxxxxxxxxxxx'
})

if (data) {
  console.log('Rebase initiated:', data.status)
}
```

### What Rebase Does

- ✅ **Applies Production Migrations** - Runs newer production migrations on branch
- ✅ **Preserves Branch Migrations** - Keeps branch-specific migrations
- ✅ **Handles Conflicts** - Resolves migration conflicts automatically

### When to Rebase

- Production has new migrations
- Branch is behind production
- Need to test branch with latest production schema

---

## 🔙 Resetting Branches

### Reset to Latest

```javascript
// Reset branch to latest production state
const { data, error } = await mcp_supabase_reset_branch({
  branch_id: 'br_xxxxxxxxxxxxx'
})
```

### Reset to Specific Migration

```javascript
// Reset to specific migration version
const { data, error } = await mcp_supabase_reset_branch({
  branch_id: 'br_xxxxxxxxxxxxx',
  migration_version: '20250101000000'
})
```

### What Reset Does

- ✅ **Drops All Data** - Removes all branch data
- ✅ **Reapplies Migrations** - Reapplies migrations up to specified version
- ✅ **Clean State** - Branch starts fresh

**⚠️ Warning:** Reset deletes all branch data. Use with caution.

---

## 🎯 Use Cases

### Use Case 1: Feature Development

```javascript
// 1. Create feature branch
const branch = await createBranch('feature-payment-gateway')

// 2. Develop in branch
// - Create migrations
// - Test changes
// - Iterate

// 3. Merge when ready
await mergeBranch(branch.id)
```

### Use Case 2: Testing Migrations

```javascript
// 1. Create test branch
const branch = await createBranch('test-migration-123')

// 2. Apply migration in branch
await applyMigration('migration_123.sql', branch.project_ref)

// 3. Test migration
await runTests(branch.project_ref)

// 4. Merge if successful
if (testsPassed) {
  await mergeBranch(branch.id)
} else {
  await deleteBranch(branch.id)
}
```

### Use Case 3: Experimentation

```javascript
// 1. Create experiment branch
const branch = await createBranch('experiment-new-schema')

// 2. Try different schema designs
// - Test performance
// - Compare approaches

// 3. Keep best approach, delete branch
await deleteBranch(branch.id)
```

### Use Case 4: Multi-Developer Workflow

```javascript
// Each developer has their own branch
const devBranch1 = await createBranch('dev-alice-feature-x')
const devBranch2 = await createBranch('dev-bob-feature-y')

// Developers work independently
// Merge when features are complete
```

---

## 📊 Best Practices

### 1. Branch Lifecycle

```
Create → Develop → Test → Merge → Delete
```

- Create branch for feature
- Develop and test in branch
- Merge to production when ready
- Delete branch after merge

### 2. Branch Naming

```javascript
// Good naming
'feature-123-payment-gateway'
'bugfix-456-fix-rls-policy'
'experiment-new-index-strategy'

// Bad naming
'branch1'
'test'
'new-feature'
```

### 3. Cost Management

- ✅ Delete unused branches
- ✅ Use branches only when needed
- ✅ Monitor branch usage
- ✅ Set branch limits

### 4. Migration Strategy

- ✅ Test migrations in branch first
- ✅ Keep migrations small and focused
- ✅ Document migration purpose
- ✅ Verify migrations before merge

### 5. Data Management

- ⚠️ Branches start with production schema but NO data
- ⚠️ Seed test data in branches
- ⚠️ Don't rely on branch data (it's temporary)
- ⚠️ Use migrations for data changes, not manual edits

---

## 🔧 Advanced Patterns

### Pattern 1: Staging Branch

```javascript
// Create permanent staging branch
const stagingBranch = await createBranch('staging')

// Deploy staging environment to this branch
// Keep branch active for continuous testing
```

### Pattern 2: Hotfix Branch

```javascript
// Create hotfix branch from production
const hotfixBranch = await createBranch('hotfix-critical-bug')

// Apply fix
await applyMigration('hotfix.sql', hotfixBranch.project_ref)

// Test quickly
await runSmokeTests(hotfixBranch.project_ref)

// Merge immediately
await mergeBranch(hotfixBranch.id)
```

### Pattern 3: Schema Comparison

```javascript
// Compare branch schema to production
async function compareSchemas(branchId) {
  const branchSchema = await getSchema(branchId)
  const productionSchema = await getSchema('production')
  
  return diffSchemas(branchSchema, productionSchema)
}
```

---

## 📚 Related Documentation

- [Supabase Platform Capabilities](./SUPABASE_PLATFORM_CAPABILITIES.md) - Full platform guide
- [Supabase MCP Guide](./SUPABASE_MCP_GUIDE.md) - MCP tools reference
- [Evolutionary Design](./best-practices/EVOLUTIONARY_DESIGN.md) - Schema evolution

---

**Last Updated:** 2025-01-22  
**Next Review:** 2025-02-22

