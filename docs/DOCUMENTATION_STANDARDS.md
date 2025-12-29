# Documentation Standards for Cursor AI

**Version:** 1.0.0  
**Last Updated:** 2025-01-21  
**Purpose:** Establish clear rules and standards for documentation organization and maintenance

---

## 📋 Table of Contents

1. [Documentation Structure](#documentation-structure)
2. [File Organization Rules](#file-organization-rules)
3. [Naming Conventions](#naming-conventions)
4. [Content Standards](#content-standards)
5. [Maintenance Rules](#maintenance-rules)
6. [AI Assistant Guidelines](#ai-assistant-guidelines)

---

## 📁 Documentation Structure

### Root Level
**ONLY** `README.md` should exist at project root. All other documentation belongs in `docs/` folder.

```
project-root/
├── README.md                    # Main project documentation (ONLY root doc)
├── docs/                        # All documentation
│   ├── DOCUMENTATION_STANDARDS.md  # This file
│   ├── design-system/          # Design system documentation
│   ├── integrations/           # Integration guides (Figma, Vercel, etc.)
│   ├── development/            # Development guides and references
│   └── architecture/           # Architecture and technical docs
└── .dev/                       # Development notes (not documentation)
    └── dev-note/               # Sprint notes, PRDs, etc.
```

### Directory Purposes

#### `docs/design-system/`
- Design system specifications
- Component patterns
- Utility class references
- Design audits and baselines

#### `docs/integrations/`
- Third-party integration guides (Figma MCP, Vercel MCP, etc.)
- API integration documentation
- External service setup guides

#### `docs/development/`
- IDE setup guides
- Code generation references
- Development workflows
- Project improvement plans

#### `docs/architecture/`
- System architecture
- Technical decisions
- Database schemas
- API specifications

#### `.dev/dev-note/`
- Sprint plans
- PRDs (Product Requirements Documents)
- Development notes
- Historical context (not user-facing docs)

---

## 📝 File Organization Rules

### Rule 1: Single Source of Truth (SSOT)
- Each topic has ONE authoritative document
- Avoid duplicate information across files
- Reference other docs instead of duplicating

### Rule 2: Root Directory Cleanliness
- **ONLY** `README.md` at root
- All other `.md` files must be in `docs/` or subdirectories
- Configuration files (`.json`, `.js`, `.ts`) are exceptions

### Rule 3: Categorization
- Group related documentation in subdirectories
- Use clear, descriptive directory names
- Keep directory depth ≤ 3 levels

### Rule 4: Historical vs Current
- **Current/Active:** `docs/` folder
- **Historical/Archive:** `.dev/dev-note/` or remove if obsolete
- Mark historical docs clearly with dates and status

---

## 🏷️ Naming Conventions

### File Names
- **MUST** use `SCREAMING_SNAKE_CASE` for all documentation files
- **MUST** use descriptive, specific names (not generic)
- **MAY** include version numbers for major versions (e.g., `DESIGN_SYSTEM_V2.md`)
- **MAY** include status suffix (e.g., `_DRAFT`, `_DEPRECATED`) for non-active docs
- **FORBIDDEN:** lowercase, camelCase, kebab-case, spaces, special characters (except `_`)

**Format:** `CATEGORY_SPECIFIC_NAME[_VERSION][_STATUS].md`

**Examples:**
- ✅ `COMPONENT_PATTERNS_LIBRARY.md`
- ✅ `FIGMA_MCP_INTEGRATION_GUIDE.md`
- ✅ `IDE_CODE_GENERATION_GUIDE.md`
- ✅ `DESIGN_SYSTEM_V2_PRODUCTION_READY.md`
- ❌ `design-system.md` (not SCREAMING_SNAKE_CASE)
- ❌ `figma.md` (not descriptive)
- ❌ `DesignSystem.md` (PascalCase not allowed)
- ❌ `design-system-guide.md` (kebab-case not allowed)

### Directory Names
- **MUST** use `kebab-case` for all directories
- **MUST** keep names short and clear
- **FORBIDDEN:** PascalCase, snake_case, spaces, special characters (except `-`)

**Examples:**
- ✅ `design-system/`
- ✅ `integrations/`
- ✅ `error-handling/`
- ✅ `workflows/`
- ❌ `DesignSystem/` (PascalCase not used)
- ❌ `design_system/` (snake_case not used)
- ❌ `Design System/` (spaces not allowed)

### Registry Requirement
- **ALL** documentation files **MUST** be registered in `docs/DOCUMENTATION_REGISTRY.md`
- **ALL** new files **MUST** be added to registry before committing
- Registry tracks: file path, version, status, last updated, purpose

---

## 📄 Content Standards

### Document Headers
Every documentation file must start with:

```markdown
# Document Title

**Version:** X.Y.Z  
**Last Updated:** YYYY-MM-DD  
**Status:** Active | Deprecated | Historical  
**Purpose:** Brief one-line description
```

### Table of Contents
- Documents > 100 lines must have a table of contents
- Use markdown links: `[Section Name](#section-name)`

### Status Indicators
Use clear status indicators:
- **Active** - Current, maintained documentation
- **Deprecated** - Replaced but kept for reference
- **Historical** - Archive, not maintained
- **Draft** - Work in progress

### Code Examples
- Include working, tested code examples
- Specify language: ` ```javascript `, ` ```bash `, etc.
- Add context and explanations

### Links and References
- Use relative paths for internal links: `[Design System](../design-system/DESIGN_SYSTEM.md)`
- Use absolute URLs for external links: `[Supabase Docs](https://supabase.com/docs)`
- Keep links updated and valid

---

## 🔄 Maintenance Rules

### Rule 1: Regular Cleanup
- Review documentation quarterly
- Remove obsolete files
- Archive historical docs to `.dev/dev-note/` or delete
- Update "Last Updated" dates when modifying

### Rule 2: Version Control
- Commit documentation changes with code changes
- Use clear commit messages: `docs: Update design system patterns`
- Tag major documentation updates

### Rule 3: Consolidation
- Merge duplicate information
- Remove redundant files
- Consolidate related topics into single documents when possible

### Rule 4: Keep README Updated
- README.md is the entry point
- Keep it concise and current
- Link to detailed docs in `docs/` folder
- Include quick start, installation, basic usage

---

## 🤖 AI Assistant Guidelines

### When Creating Documentation

1. **Check existing docs first**
   - Search for similar documentation
   - Avoid creating duplicates
   - Update existing docs instead of creating new ones

2. **Follow structure rules**
   - Place in appropriate `docs/` subdirectory
   - Use correct naming conventions
   - Include proper headers and metadata

3. **Maintain SSOT**
   - Reference existing docs instead of duplicating
   - Link to authoritative sources
   - Update existing docs rather than creating alternatives

4. **Clean up after creation**
   - Remove any temporary files
   - Update README if adding new major sections
   - Ensure no duplicate information

### When Organizing Documentation

1. **Categorize correctly**
   - Design system → `docs/design-system/`
   - Integration guides → `docs/integrations/`
   - Development guides → `docs/development/`
   - Architecture → `docs/architecture/`

2. **Remove from root**
   - Move all `.md` files from root to `docs/` (except README.md)
   - Update any references/links
   - Verify no broken links

3. **Archive historical docs**
   - Move to `.dev/dev-note/` if needed for reference
   - Or delete if truly obsolete
   - Mark clearly as historical

### When Updating Documentation

1. **Update metadata**
   - Update "Last Updated" date
   - Update version if significant changes
   - Update status if needed

2. **Maintain links**
   - Check all internal links still work
   - Update links if files moved
   - Verify external links

3. **Keep README current**
   - Update README when adding major features
   - Update links to new documentation
   - Keep installation/usage current

---

## ✅ Documentation Checklist

Before committing documentation changes:

- [ ] File is in correct `docs/` subdirectory (not root)
- [ ] File name follows `SCREAMING_SNAKE_CASE` convention
- [ ] Directory name follows `kebab-case` convention (if creating new directory)
- [ ] Document has proper header with version, date, status
- [ ] **File registered in `DOCUMENTATION_REGISTRY.md`**
- [ ] Table of contents included (if > 100 lines)
- [ ] No duplicate information with existing docs
- [ ] All links are valid and working
- [ ] Code examples are tested and working
- [ ] README.md updated if adding major sections
- [ ] No temporary or test files left behind
- [ ] Historical/obsolete docs archived or removed
- [ ] **Validation script passes:** `node scripts/validate-docs-naming.mjs`

---

## 🚫 Anti-Patterns (What NOT to Do)

1. **Don't create docs at root**
   - ❌ `project-root/DESIGN_SYSTEM.md`
   - ✅ `project-root/docs/design-system/DESIGN_SYSTEM.md`

2. **Don't duplicate information**
   - ❌ Same content in multiple files
   - ✅ Single source, reference it

3. **Don't use generic names**
   - ❌ `guide.md`, `notes.md`, `info.md`
   - ✅ `FIGMA_MCP_INTEGRATION_GUIDE.md`

4. **Don't leave obsolete docs**
   - ❌ Keep old versions alongside new
   - ✅ Archive or delete, mark clearly

5. **Don't skip metadata**
   - ❌ Document without header
   - ✅ Always include version, date, status

---

## 📚 Quick Reference

### Where to Put Documentation

| Type | Location | Example |
|------|----------|---------|
| Design System | `docs/design-system/` | Component patterns, utilities |
| Integration Guides | `docs/integrations/` | Figma MCP, Vercel MCP |
| Development Guides | `docs/development/` | IDE setup, code generation |
| Architecture | `docs/architecture/` | System design, APIs |
| Sprint Notes | `.dev/dev-note/` | Sprint plans, PRDs |
| Main Entry | `README.md` | Project overview, quick start |

### File Naming Examples

| Purpose | Good Name | Bad Name |
|---------|-----------|----------|
| Integration Guide | `FIGMA_MCP_INTEGRATION_GUIDE.md` | `figma.md` |
| Component Patterns | `COMPONENT_PATTERNS_LIBRARY.md` | `components.md` |
| Design System | `DESIGN_SYSTEM_V2_PRODUCTION_READY.md` | `design.md` |
| Development Guide | `IDE_CODE_GENERATION_GUIDE.md` | `ide.md` |

---

## 🔗 Related Documentation

- [README.md](../README.md) - Main project documentation
- [.dev/dev-note/VMP 21Sprint.md](../.dev/dev-note/VMP%2021Sprint.md) - Current sprint plan

---

**Remember:** Clean, organized documentation is easier to maintain, find, and use. Follow these standards to keep the project documentation professional and accessible.