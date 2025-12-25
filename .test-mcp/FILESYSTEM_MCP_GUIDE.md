# Filesystem MCP - Complete Usage & Optimization Guide

## Table of Contents
1. [Quick Start](#quick-start)
2. [All Available Operations](#all-available-operations)
3. [Optimization Strategies](#optimization-strategies)
4. [Best Practices](#best-practices)
5. [Performance Tips](#performance-tips)
6. [Common Patterns](#common-patterns)
7. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Basic Read Operations

```javascript
// Read entire file
read_text_file("path/to/file.txt")

// Read first 50 lines only (for large files)
read_text_file("path/to/file.txt", head: 50)

// Read last 20 lines only
read_text_file("path/to/file.txt", tail: 20)

// Read multiple files at once (FASTER than sequential)
read_multiple_files([
  "path/to/file1.txt",
  "path/to/file2.txt",
  "path/to/file3.txt"
])
```

### Basic Write Operations

```javascript
// Create/overwrite file
write_file("path/to/file.txt", "file content here")

// Edit file (line-based replacements)
edit_file("path/to/file.txt", [
  { oldText: "old content", newText: "new content" }
])

// Create directory
create_directory("path/to/new/directory")
```

---

## All Available Operations

### 1. Reading Files

#### `read_text_file(path, head?, tail?)`
Read text files with optional head/tail limits.

**When to use:**
- Reading configuration files
- Reading source code
- Reading documentation
- Large files (use head/tail to avoid loading everything)

**Example:**
```javascript
// Read entire file
read_text_file("package.json")

// Read first 30 lines (for large files)
read_text_file("server.js", head: 30)

// Read last 20 lines (for logs)
read_text_file("app.log", tail: 20)
```

#### `read_multiple_files(paths[])`
Read multiple files in parallel (MUCH FASTER than sequential).

**When to use:**
- Reading related files together
- Comparing multiple files
- Loading configuration + source files
- Batch operations

**Example:**
```javascript
read_multiple_files([
  "package.json",
  "README.md",
  "vercel.json"
])
// Returns all 3 files in one call - faster!
```

#### `read_media_file(path)`
Read images/audio as base64.

**When to use:**
- Processing images
- Reading binary files
- Media analysis

---

### 2. File Information

#### `get_file_info(path)`
Get metadata without reading content.

**Returns:**
- Size (bytes)
- Creation date
- Modified date
- Permissions
- Is directory/file

**When to use:**
- Checking if file exists
- Getting file size before reading
- Checking modification dates
- Permission checks

**Example:**
```javascript
get_file_info("server.js")
// Returns: { size: 9409, modified: "2025-01-21", ... }
```

---

### 3. Directory Operations

#### `list_directory(path)`
Basic file/directory listing.

**When to use:**
- Quick directory overview
- Checking what's in a folder

#### `list_directory_with_sizes(path, sortBy?)`
List with file sizes, sortable.

**Parameters:**
- `sortBy: "name"` or `"size"` (default: "name")

**When to use:**
- Finding large files
- Analyzing directory contents
- Disk space analysis

**Example:**
```javascript
// Find largest files
list_directory_with_sizes(".", sortBy: "size")
// Returns files sorted by size (largest first)
```

#### `directory_tree(path, excludePatterns?)`
Recursive JSON tree structure.

**When to use:**
- Understanding project structure
- Generating documentation
- Visualizing directory hierarchy

**Example:**
```javascript
directory_tree("src", excludePatterns: ["node_modules", ".git"])
```

---

### 4. Search Operations

#### `search_files(path, pattern, excludePatterns?)`
Glob pattern search (supports `**/*.ext` for recursive).

**Patterns:**
- `*.js` - All JS files in directory
- `**/*.js` - All JS files recursively
- `**/*test*.js` - All test JS files
- `*.{js,ts}` - JS or TS files

**When to use:**
- Finding all files of a type
- Locating specific file patterns
- Project-wide searches

**Example:**
```javascript
// Find all markdown files
search_files(".", "*.md", excludePatterns: ["node_modules"])

// Find all test files recursively
search_files(".", "**/*test*.js")

// Find all config files
search_files(".", "*.{json,yaml,yml}")
```

---

### 5. Write Operations

#### `write_file(path, content)`
Create or overwrite file completely.

**When to use:**
- Creating new files
- Complete file replacement
- Generating files

**Example:**
```javascript
write_file("config.json", JSON.stringify({ key: "value" }, null, 2))
```

#### `edit_file(path, edits[], dryRun?)`
Line-based text edits (returns git-style diff).

**Parameters:**
- `edits`: Array of `{ oldText, newText }`
- `dryRun`: Preview changes without applying

**When to use:**
- Making specific changes
- Updating sections of files
- Precise edits

**Example:**
```javascript
edit_file("package.json", [
  {
    oldText: '"version": "0.1.0"',
    newText: '"version": "0.2.0"'
  }
])
```

**Important:** `oldText` must match EXACTLY (including whitespace, newlines).

#### `create_directory(path)`
Create directory (creates nested paths automatically).

**When to use:**
- Setting up project structure
- Creating new folders
- Organizing files

**Example:**
```javascript
// Creates all nested directories if needed
create_directory("src/components/ui")
```

#### `move_file(source, destination)`
Move or rename files.

**When to use:**
- Renaming files
- Reorganizing structure
- Moving files between directories

---

## Optimization Strategies

### 1. **Batch Operations** (CRITICAL for Performance)

❌ **SLOW - Sequential:**
```javascript
read_text_file("file1.txt")  // Wait...
read_text_file("file2.txt")  // Wait...
read_text_file("file3.txt")  // Wait...
// Total: 3 separate calls = 3x network overhead
```

✅ **FAST - Parallel:**
```javascript
read_multiple_files([
  "file1.txt",
  "file2.txt", 
  "file3.txt"
])
// Total: 1 call = 1x network overhead
// 3x faster!
```

### 2. **Use Head/Tail for Large Files**

❌ **SLOW - Reading entire large file:**
```javascript
read_text_file("large-log.txt")  // Loads 10MB into memory
```

✅ **FAST - Read only what you need:**
```javascript
read_text_file("large-log.txt", tail: 50)  // Only last 50 lines
read_text_file("config.js", head: 100)     // Only first 100 lines
```

### 3. **Check File Info Before Reading**

✅ **Efficient - Check size first:**
```javascript
const info = get_file_info("file.txt")
if (info.size > 1000000) {  // If > 1MB
  read_text_file("file.txt", head: 100)  // Read only head
} else {
  read_text_file("file.txt")  // Read full file
}
```

### 4. **Use Search Instead of Manual Traversal**

❌ **SLOW - Manual directory walking:**
```javascript
list_directory("src")
list_directory("src/components")
list_directory("src/components/ui")
// Multiple calls
```

✅ **FAST - Pattern search:**
```javascript
search_files(".", "**/*.js", excludePatterns: ["node_modules"])
// One call finds everything
```

### 5. **Cache Directory Trees**

For repeated operations, get tree once:
```javascript
// Get once, reuse
const tree = directory_tree("src")
// Use tree data for multiple operations
```

---

## Best Practices

### 1. **Always Use Exclude Patterns**

```javascript
// ✅ Good
search_files(".", "*.js", excludePatterns: ["node_modules", ".git"])

// ❌ Bad - searches node_modules (slow, unnecessary)
search_files(".", "*.js")
```

### 2. **Use Appropriate Operations**

- **Need file content?** → `read_text_file` or `read_multiple_files`
- **Need file metadata?** → `get_file_info` (faster, no content load)
- **Need to find files?** → `search_files` (not manual traversal)
- **Need directory structure?** → `directory_tree` (not recursive list)

### 3. **Handle Large Files Carefully**

```javascript
// For files > 1MB, always use head/tail
const info = get_file_info("large-file.txt")
if (info.size > 1000000) {
  // Read in chunks or use head/tail
  read_text_file("large-file.txt", head: 1000)
}
```

### 4. **Batch Related Operations**

```javascript
// ✅ Good - Read related files together
read_multiple_files([
  "package.json",
  "package-lock.json",
  "tsconfig.json"
])

// ❌ Bad - Separate calls
read_text_file("package.json")
read_text_file("package-lock.json")
read_text_file("tsconfig.json")
```

### 5. **Use Dry Run for Edits**

```javascript
// Preview changes first
edit_file("file.txt", edits, dryRun: true)
// Review diff, then apply
edit_file("file.txt", edits, dryRun: false)
```

---

## Performance Tips

### Speed Comparison (Approximate)

1. **Fastest:** `get_file_info` (metadata only, no content)
2. **Very Fast:** `list_directory` (no recursion)
3. **Fast:** `read_multiple_files` (parallel, 1 network call)
4. **Medium:** `read_text_file` with head/tail
5. **Slower:** `read_text_file` full file
6. **Slowest:** `directory_tree` on large trees

### Optimization Checklist

- [ ] Use `read_multiple_files` instead of sequential reads
- [ ] Use `head`/`tail` for files > 100KB
- [ ] Use `get_file_info` to check size before reading
- [ ] Use `search_files` instead of manual traversal
- [ ] Always exclude `node_modules`, `.git` in searches
- [ ] Use `list_directory_with_sizes` only when size needed
- [ ] Cache directory trees for repeated use

---

## Common Patterns

### Pattern 1: Read Project Configuration

```javascript
// Read all config files at once
const configs = read_multiple_files([
  "package.json",
  "tsconfig.json",
  ".eslintrc.json",
  "vercel.json"
])
```

### Pattern 2: Find All Source Files

```javascript
// Find all source files
const jsFiles = search_files("src", "**/*.js", excludePatterns: ["node_modules"])
const tsFiles = search_files("src", "**/*.ts", excludePatterns: ["node_modules"])
```

### Pattern 3: Analyze Large Files

```javascript
// Check size first
const info = get_file_info("large-file.log")
if (info.size > 50000) {
  // Read only last 100 lines
  const content = read_text_file("large-file.log", tail: 100)
} else {
  // Read full file
  const content = read_text_file("large-file.log")
}
```

### Pattern 4: Batch File Updates

```javascript
// Read multiple files
const files = read_multiple_files(["file1.txt", "file2.txt", "file3.txt"])

// Process all
files.forEach(file => {
  const updated = processFile(file.content)
  write_file(file.path, updated)
})
```

### Pattern 5: Project Structure Analysis

```javascript
// Get full structure
const tree = directory_tree(".", excludePatterns: ["node_modules", ".git"])

// Find all HTML files
const htmlFiles = search_files(".", "**/*.html", excludePatterns: ["node_modules"])

// Get sizes
const sizes = list_directory_with_sizes("src", sortBy: "size")
```

---

## Troubleshooting

### Issue: "Access denied - path outside allowed directories"

**Solution:** Path must be within configured directories in `mcp.json`

**Check:**
```json
{
  "filesystem": {
    "args": [
      "c:\\AI-BOS\\AIBOS-VMP"  // Your path must be inside this
    ]
  }
}
```

### Issue: Edit operations fail

**Solution:** `oldText` must match EXACTLY including:
- Whitespace
- Newlines
- Indentation
- Special characters

**Tip:** Use `read_text_file` first to see exact content, then match it precisely.

### Issue: Slow operations

**Solutions:**
1. Use `read_multiple_files` instead of sequential reads
2. Add exclude patterns to searches
3. Use head/tail for large files
4. Check file size with `get_file_info` first

### Issue: Can't write files

**Check:**
1. `readOnly: true` removed from `mcp.json`?
2. Cursor restarted after config change?
3. File permissions allow writing?
4. Path is within allowed directories?

---

## Summary

### Key Takeaways

1. **Always batch:** Use `read_multiple_files` for multiple files
2. **Use head/tail:** For files > 100KB, use head/tail parameters
3. **Exclude patterns:** Always exclude `node_modules`, `.git` in searches
4. **Check info first:** Use `get_file_info` to check size before reading
5. **Search, don't traverse:** Use `search_files` instead of manual directory walking

### Performance Priority

1. **Fastest:** Metadata operations (`get_file_info`, `list_directory`)
2. **Fast:** Batch reads (`read_multiple_files`)
3. **Medium:** Single reads with limits (`read_text_file` with head/tail)
4. **Slower:** Full file reads, large directory trees

### Most Common Operations

1. `read_multiple_files` - Read related files
2. `search_files` - Find files by pattern
3. `read_text_file` with head/tail - Read large files efficiently
4. `get_file_info` - Check file before reading
5. `directory_tree` - Understand project structure

---

**Last Updated:** 2025-01-21
**Status:** All operations tested and working ✅