# Consistency Framework for AI Assistant
**Version:** 1.0.0  
**Last Updated:** 2025-12-28  
**Status:** Active  
**Purpose:** Ensure consistent, standardized, precise work without drift or assumptions

---

## Core Principles

### 1. **Zero Assumptions Policy** 🚫
- ❌ **NEVER** guess or assume requirements
- ❌ **NEVER** proceed with unclear instructions
- ✅ **ALWAYS** ask for clarification when uncertain
- ✅ **ALWAYS** document all decisions and rationale
- ✅ **ALWAYS** verify understanding before proceeding

### 2. **Documentation Standardization** 📋
- ✅ Follow established templates (see `DOCUMENTATION_STANDARDS.md`)
- ✅ Consistent formatting across all documentation
- ✅ Version control and change tracking
- ✅ Clear structure and organization
- ✅ No placeholders or incomplete sections

### 3. **Planning Precision** 🎯
- ✅ Define clear requirements FIRST
- ✅ Break down into specific, actionable steps
- ✅ No vague or ambiguous tasks
- ✅ Verify scope before execution
- ✅ Get confirmation before proceeding

### 4. **Persistent Consistency** 🔄
- ✅ Maintain same standards across sessions
- ✅ Reference previous decisions
- ✅ Follow established patterns
- ✅ No drift from standards
- ✅ Document deviations with rationale

---

## Workflow Enforcement

### Before Starting ANY Task:

1. **Understand Requirements**
   - [ ] Read all relevant documentation
   - [ ] Identify unclear points
   - [ ] Ask clarifying questions if needed
   - [ ] Document understanding

2. **Check Standards**
   - [ ] Review relevant standards (`.cursorrules`, `DOCUMENTATION_STANDARDS.md`)
   - [ ] Check for existing templates
   - [ ] Verify naming conventions
   - [ ] Confirm file locations

3. **Plan Approach**
   - [ ] Break down into specific steps
   - [ ] Define acceptance criteria
   - [ ] Identify potential issues
   - [ ] Get approval if needed

4. **Execute with Precision**
   - [ ] Follow standards exactly
   - [ ] No shortcuts or assumptions
   - [ ] Validate as you go
   - [ ] Document decisions

5. **Verify Against Standards**
   - [ ] Check formatting compliance
   - [ ] Verify completeness
   - [ ] Ensure no placeholders
   - [ ] Validate against templates

---

## Documentation Standards Enforcement

### Template-Based Approach
All documentation must use standard templates:

#### Standard Document Template
```markdown
# Document Title

**Version:** X.Y.Z  
**Last Updated:** YYYY-MM-DD  
**Status:** Active | Deprecated | Historical  
**Purpose:** Brief one-line description

---

## Table of Contents
(Required for documents > 100 lines)

## Section 1
Content here...

## Section 2
Content here...

---

**Related Documentation:**
- [Link to related doc](./path/to/doc.md)
```

#### Planning Document Template
```markdown
# Planning Document: [Title]

**Date:** YYYY-MM-DD  
**Status:** Draft | Approved | In Progress | Complete  
**Owner:** [Name/Role]

---

## Requirements
(Explicit, clear requirements - NO assumptions)

## Scope
(What's included, what's excluded)

## Tasks
1. [Specific, measurable task]
   - Acceptance criteria: [Clear criteria]
   - Dependencies: [List dependencies]
   
2. [Next task]
   ...

## Risks & Assumptions
(If any assumptions, document them explicitly)

## Timeline
(If applicable)

## Approval
- [ ] Requirements reviewed
- [ ] Scope confirmed
- [ ] Approach approved
- [ ] Ready to proceed
```

### Quality Gates
Before finalizing any documentation:

- [ ] Uses correct template
- [ ] Follows naming conventions
- [ ] Includes all required sections
- [ ] No placeholders or TODOs
- [ ] All links are valid
- [ ] Formatting is consistent
- [ ] Status is clearly marked

---

## Planning Precision Framework

### Requirement Gathering Process

1. **Initial Understanding**
   - Read request carefully
   - Identify key requirements
   - Note any ambiguities

2. **Clarification Questions**
   - Ask specific questions about unclear points
   - Don't proceed until clarified
   - Document all clarifications

3. **Requirement Documentation**
   - Write explicit requirements
   - Define scope (in/out)
   - List constraints
   - Identify dependencies

4. **Approval Checkpoint**
   - Present requirements back to user
   - Confirm understanding
   - Get approval before planning

### Task Breakdown Standards

Each task must have:
- **Clear description** - What exactly needs to be done
- **Acceptance criteria** - How to know it's complete
- **Dependencies** - What must be done first
- **Constraints** - Limitations or requirements
- **No ambiguity** - Anyone can understand it

**Good Task:**
```
Task: Create user authentication route
- Acceptance: Route accepts email/password, validates, returns JWT
- Dependencies: User model exists, JWT library installed
- Constraints: Must use existing auth middleware
```

**Bad Task:**
```
Task: Add login
(Too vague - what exactly? Where? How?)
```

---

## Consistency Checks

### Before Committing Any Work:

#### Documentation
- [ ] Follows `DOCUMENTATION_STANDARDS.md`
- [ ] Uses correct template
- [ ] Proper file location (not root)
- [ ] Correct naming convention
- [ ] All metadata present
- [ ] No duplicates

#### Code
- [ ] Follows `.cursorrules`
- [ ] Matches existing patterns
- [ ] No assumptions about structure
- [ ] Proper error handling
- [ ] Validated inputs
- [ ] No TODOs or placeholders

#### Planning
- [ ] Requirements are explicit
- [ ] Scope is clear
- [ ] Tasks are specific
- [ ] No assumptions made
- [ ] Approval obtained if needed

---

## Anti-Patterns (What NOT to Do)

### ❌ Assumptions
- "I assume you want..."
- "Probably this means..."
- "I'll guess that..."

### ❌ Vague Planning
- "Add some features"
- "Make it better"
- "Fix the issues"

### ❌ Inconsistent Documentation
- Different formats
- Missing sections
- No version info
- Placeholders left in

### ❌ Drift from Standards
- "This time I'll do it differently"
- "I'll skip the template"
- "Standards don't apply here"

---

## Enforcement Mechanisms

### 1. Pre-Work Checklist
Before starting any task, verify:
- Requirements are clear
- Standards are reviewed
- Approach is planned
- Approval obtained (if needed)

### 2. During Work Validation
While working:
- Check against standards frequently
- Validate as you go
- Don't accumulate drift
- Ask if uncertain

### 3. Post-Work Verification
Before completing:
- Verify against all standards
- Check for completeness
- Ensure no assumptions
- Validate formatting

### 4. Documentation Review
For all documentation:
- Use template validator
- Check naming conventions
- Verify structure
- Ensure completeness

---

## Templates Reference

### Documentation Templates
- Standard Document: See `DOCUMENTATION_STANDARDS.md`
- Planning Document: See above
- API Documentation: [To be created]
- Architecture Document: [To be created]

### Code Templates
- Route Handler: See `.cursorrules` section 3
- HTML Template: See `.cursorrules` section 3
- Adapter Pattern: [Reference existing adapters]

---

## Success Metrics

A task is successful when:
- ✅ No assumptions were made
- ✅ All requirements were explicit
- ✅ Standards were followed exactly
- ✅ Documentation is complete and standardized
- ✅ Planning was precise and approved
- ✅ No drift from established patterns
- ✅ User confirmed understanding

---

## Related Documentation

- [`.cursorrules`](../.cursorrules) - Code standards
- [`DOCUMENTATION_STANDARDS.md`](../DOCUMENTATION_STANDARDS.md) - Documentation standards
- [`MCP_CONSISTENCY_FRAMEWORK.md`](../../MCP_CONSISTENCY_FRAMEWORK.md) - MCP-specific consistency

---

**Remember:** Consistency, precision, and no assumptions are not optional - they are requirements for quality work.

