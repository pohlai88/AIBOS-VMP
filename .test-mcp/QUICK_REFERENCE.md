# Filesystem MCP - Quick Reference Cheat Sheet

## 🚀 Most Common Operations

### Read Files
```javascript
// Single file
read_text_file("path/to/file.txt")

// Multiple files (FASTER - use this!)
read_multiple_files(["file1.txt", "file2.txt", "file3.txt"])

// Large files (use head/tail)
read_text_file("large.log", head: 50)   // First 50 lines
read_text_file("large.log", tail: 20)   // Last 20 lines
```

### File Info
```javascript
get_file_info("file.txt")  // Get size, dates, permissions
```

### Search Files
```javascript
// Find all JS files
search_files(".", "**/*.js", excludePatterns: ["node_modules"])

// Find all markdown files
search_files(".", "*.md", excludePatterns: ["node_modules"])
```

### Write Files
```javascript
// Create/overwrite
write_file("file.txt", "content")

// Edit (line-based)
edit_file("file.txt", [
  { oldText: "old", newText: "new" }
])
```

---

## ⚡ Performance Optimization Rules

### Rule 1: Always Batch Reads
```javascript
// ❌ SLOW (3 calls)
read_text_file("file1.txt")
read_text_file("file2.txt")
read_text_file("file3.txt")

// ✅ FAST (1 call)
read_multiple_files(["file1.txt", "file2.txt", "file3.txt"])
```

### Rule 2: Use Head/Tail for Large Files
```javascript
// ❌ SLOW (loads entire 10MB file)
read_text_file("large.log")

// ✅ FAST (only last 50 lines)
read_text_file("large.log", tail: 50)
```

### Rule 3: Check Size First
```javascript
const info = get_file_info("file.txt")
if (info.size > 100000) {  // > 100KB
  read_text_file("file.txt", head: 100)
} else {
  read_text_file("file.txt")
}
```

### Rule 4: Always Exclude node_modules
```javascript
// ✅ Good
search_files(".", "*.js", excludePatterns: ["node_modules", ".git"])

// ❌ Bad (searches node_modules - very slow!)
search_files(".", "*.js")
```

---

## 📋 Operation Speed Ranking

1. **Fastest:** `get_file_info` (metadata only)
2. **Very Fast:** `list_directory` (no recursion)
3. **Fast:** `read_multiple_files` (parallel)
4. **Medium:** `read_text_file` with head/tail
5. **Slower:** `read_text_file` full file
6. **Slowest:** `directory_tree` on large trees

---

## 🎯 Common Patterns

### Pattern 1: Read All Config Files
```javascript
read_multiple_files([
  "package.json",
  "tsconfig.json",
  ".eslintrc.json"
])
```

### Pattern 2: Find All Source Files
```javascript
const jsFiles = search_files("src", "**/*.js", 
  excludePatterns: ["node_modules"])
```

### Pattern 3: Analyze Large File
```javascript
const info = get_file_info("log.txt")
if (info.size > 50000) {
  read_text_file("log.txt", tail: 100)  // Last 100 lines
}
```

---

## ⚠️ Common Mistakes

1. **Sequential reads instead of batch**
   - ❌ Multiple `read_text_file` calls
   - ✅ Single `read_multiple_files` call

2. **Reading entire large files**
   - ❌ `read_text_file("10MB-file.log")`
   - ✅ `read_text_file("10MB-file.log", tail: 50)`

3. **Not excluding node_modules**
   - ❌ `search_files(".", "*.js")`
   - ✅ `search_files(".", "*.js", excludePatterns: ["node_modules"])`

4. **Manual directory traversal**
   - ❌ Multiple `list_directory` calls
   - ✅ Single `search_files` with pattern

---

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Access denied" | Check path is in `mcp.json` allowed directories |
| Edit fails | `oldText` must match EXACTLY (whitespace, newlines) |
| Slow operations | Use batch reads, head/tail, exclude patterns |
| Can't write | Remove `readOnly: true` from config, restart Cursor |

---

## 📚 Full Documentation

See `FILESYSTEM_MCP_GUIDE.md` for complete documentation.

---

**Quick Tips:**
- Batch operations = 3x faster
- Head/tail = 10x faster for large files
- Exclude patterns = 5x faster searches
- Check file info before reading = smarter decisions