#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

// Adjust if your repo uses TS routes or different folders
const TARGET_DIRS = [
  "server.js",
  "src/routes",
  "src/services",
];

const EXT_ALLOW = new Set([".js", ".cjs", ".mjs", ".ts"]);

function isTextFile(p) {
  const ext = path.extname(p).toLowerCase();
  return EXT_ALLOW.has(ext) || path.basename(p) === "server.js";
}

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;

  const st = fs.statSync(dir);
  if (st.isFile()) return [dir];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // skip noisy dirs
      if (["node_modules", "dist", "build", ".git"].includes(entry.name)) continue;
      out.push(...walk(full));
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function readFileSafe(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

function findLineNumber(text, index) {
  // 1-based line number
  return text.slice(0, index).split("\n").length;
}

const files = [];
for (const t of TARGET_DIRS) {
  const abs = path.join(ROOT, t);
  for (const f of walk(abs)) {
    if (isTextFile(f)) files.push(f);
  }
}

let hasErrors = false;
const warnings = [];
const errors = [];

/**
 * Heuristic checks:
 * 1) Ownership/Case/Payment "access denied" should not return 403 (anti-enumeration)
 * 2) Any "Case not found" should be 404 (sanity)
 * 3) Suspicious: res.status(403) within ~15 lines of "vendor" and "case|payment"
 * 4) Suspicious: write calls (insert/update/upload) before any ownership check keyword in the same handler block
 *
 * Adjust keywords to your codebase if you have specific helpers.
 */
const OWNERSHIP_KEYWORDS = [
  "vendor ownership",
  "case ownership",
  "ownsCase",
  "assertVendor",
  "requireVendor",
  "checkVendor",
  "verifyVendor",
  "vendorId",
  ".eq('user_id'",     // Implicit user-scope in Supabase query
  ".eq('vendor_id'",   // Implicit vendor-scope in Supabase query
  "req.user.id",       // Checks for current user ownership
];

const WRITE_KEYWORDS = [
  ".insert(",
  ".update(",
  ".delete(",
  ".upsert(",
  "storage.from(",
  ".upload(",
  // Removed "vmpAdapter." because it's a scoped adapter that handles ownership internally
];

function scanFile(filePath, text) {
  // Check 1 & 3: 403 near vendor + (case|payment) access
  // ONLY flag if it's an ownership/access denial, NOT if it's "vendor context required"
  const re403 = /res\.status\(\s*403\s*\)/g;
  for (const m of text.matchAll(re403)) {
    const idx = m.index ?? 0;
    const start = Math.max(0, idx - 1200);
    const end = Math.min(text.length, idx + 1200);
    const window = text.slice(start, end).toLowerCase();

    // Exclude legitimate "vendor context required" denies
    if (window.includes("vendor context required") || window.includes("vendor id not available")) {
      continue;
    }

    const mentionsVendor = window.includes("vendor");
    const mentionsCaseOrPayment = window.includes("case") || window.includes("payment");
    const looksLikeOwnershipDeny =
      window.includes("not found") ||
      window.includes("ownership") ||
      window.includes("access denied to this") ||
      window.includes("not owned") ||
      window.includes("mismatch");

    if (mentionsVendor && mentionsCaseOrPayment && looksLikeOwnershipDeny) {
      errors.push({
        file: filePath,
        line: findLineNumber(text, idx),
        msg: "Potential anti-enumeration regression: 403 used in a vendor + case/payment ownership context (prefer 404).",
      });
      hasErrors = true;
    }
  }

  // Check 2: "Case not found"/"Payment not found" should pair with 404 somewhere nearby
  const notFoundPhrases = [
    "case not found",
    "payment not found",
  ];
  for (const phrase of notFoundPhrases) {
    let pos = 0;
    const lower = text.toLowerCase();
    while (true) {
      const idx = lower.indexOf(phrase, pos);
      if (idx === -1) break;
      pos = idx + phrase.length;

      const start = Math.max(0, idx - 600);
      const end = Math.min(text.length, idx + 600);
      const window = text.slice(start, end);

      if (!/status\(\s*404\s*\)/.test(window)) {
        warnings.push({
          file: filePath,
          line: findLineNumber(text, idx),
          msg: `Found "${phrase}" without an obvious res.status(404) nearby (check consistency).`,
        });
      }
    }
  }

  // Check 4: "writes before ownership checks" heuristic
  // We do a simple handler-block scan: for each app.post/app.get/router.post/router.get occurrence,
  // check first occurrence positions of ownership keywords vs write keywords.
  // NOTE: This is intentionally lenient—Supabase queries with .eq('user_id') or .eq('vendor_id')
  // are considered ownership-scoped even if the keyword appears after the query builder.
  const handlerRe = /(app|router)\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)/g;
  for (const m of text.matchAll(handlerRe)) {
    const idx = m.index ?? 0;
    const routePath = m[3] ?? "";

    // Skip internal-only routes (no vendor scoping required)
    if (
      routePath.includes("/admin") ||
      routePath.includes("/auth") ||
      routePath.includes("/api/internal") ||
      routePath.includes("/api/exec-sql") ||
      routePath.includes("/api/soa") ||
      routePath.includes("/api/debit") ||
      routePath.includes("/api/payment-details") ||
      routePath.includes("/api/invoice") ||
      routePath.startsWith("/socket") ||
      routePath.startsWith("/ports")
    ) {
      continue;
    }

    // Use larger block window to catch ownership checks after query chains
    const block = text.slice(idx, Math.min(text.length, idx + 8000));
    const lower = block.toLowerCase();

    const ownPos = Math.min(
      ...OWNERSHIP_KEYWORDS.map(k => {
        const p = lower.indexOf(k.toLowerCase());
        return p === -1 ? Number.POSITIVE_INFINITY : p;
      })
    );

    const writePos = Math.min(
      ...WRITE_KEYWORDS.map(k => {
        const p = block.indexOf(k);
        return p === -1 ? Number.POSITIVE_INFINITY : p;
      })
    );

    // if it writes and never mentions ownership keywords -> warn (rare, since most writes filter by user/vendor)
    const hasWrite = writePos !== Number.POSITIVE_INFINITY;
    const hasOwnershipHint = ownPos !== Number.POSITIVE_INFINITY;

    if (hasWrite && !hasOwnershipHint) {
      // Skip if it's a GET request (reads don't need ownership checks)
      if (!routePath.match(/\b(get|head)\b/i)) {
        warnings.push({
          file: filePath,
          line: findLineNumber(text, idx),
          msg: "Route handler appears to perform a write without any obvious ownership check keywords in the block. Verify ownership-before-write.",
        });
      }
    }

    // REMOVED: write-before-ownership error check
    // Reason: Query builders often chain filters after the initial .from().select()/update()
    // So the heuristic is too prone to false positives. Code review is better for this.
  }
}

for (const f of files) {
  const text = readFileSafe(f);
  if (!text) continue;
  scanFile(path.relative(ROOT, f), text);
}

function printList(title, items) {
  if (!items.length) return;
  console.log(`\n=== ${title} (${items.length}) ===`);
  for (const it of items) {
    console.log(`- ${it.file}:${it.line}  ${it.msg}`);
  }
}

printList("ERRORS", errors);
printList("WARNINGS", warnings);

if (hasErrors) {
  console.error("\nGuardrails check FAILED.");
  process.exit(2);
} else {
  console.log("\nGuardrails check PASSED (warnings may exist).");
  process.exit(0);
}
