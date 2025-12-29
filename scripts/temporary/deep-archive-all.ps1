# ============================================================================
# DEEP ARCHIVE - COMPREHENSIVE BULK ARCHIVE
# ============================================================================
# Archives ALL broken, legacy, immature, and documentation files
# ============================================================================

$ErrorActionPreference = "SilentlyContinue"
$archive = ".archive"

Write-Host "`n=== DEEP ARCHIVE - BULK OPERATION ===" -ForegroundColor Cyan
Write-Host "Starting comprehensive archive..." -ForegroundColor Yellow
$startTime = Get-Date

# Create archive structure
$dirs = @(
    "$archive\all-markdown",
    "$archive\all-legacy-code", 
    "$archive\all-broken",
    "$archive\all-todos",
    "$archive\dev-notes",
    "$archive\docs",
    "$archive\legacy-tests-all",
    "$archive\legacy-scripts-all",
    "$archive\legacy-utils-all"
)

foreach ($dir in $dirs) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
}

# ============================================================================
# 1. ARCHIVE ALL MARKDOWN FILES (except active docs)
# ============================================================================
Write-Host "`n[1/8] Archiving markdown files..." -ForegroundColor Yellow
$mdFiles = Get-ChildItem -Path "." -Recurse -File -Include "*.md" | 
    Where-Object { 
        $_.FullName -notmatch "node_modules|\.git|\.archive" -and
        $_.FullName -match "dev-note|\.dev|docs" 
    }

$mdCount = 0
foreach ($file in $mdFiles) {
    $relPath = $file.FullName.Replace((Get-Location).Path + "\", "")
    $dest = Join-Path $archive "all-markdown" $file.Name
    Copy-Item $file.FullName $dest -Force
    $mdCount++
}
Write-Host "   Archived $mdCount markdown files" -ForegroundColor Green

# ============================================================================
# 2. ARCHIVE ALL DEV-NOTE FILES
# ============================================================================
Write-Host "`n[2/8] Archiving dev-note files..." -ForegroundColor Yellow
$devNotes = Get-ChildItem -Path ".dev\dev-note" -Recurse -File
$devCount = 0
foreach ($file in $devNotes) {
    $dest = Join-Path $archive "dev-notes" $file.Name
    Copy-Item $file.FullName $dest -Force
    $devCount++
}
Write-Host "   Archived $devCount dev-note files" -ForegroundColor Green

# ============================================================================
# 3. ARCHIVE ALL FILES WITH vmpAdapter/vendorRouter/clientRouter
# ============================================================================
Write-Host "`n[3/8] Archiving files with broken imports..." -ForegroundColor Yellow
$brokenFiles = @(
    "server.js",
    "src\utils\soa-matching-engine.js",
    "src\utils\push-sender.js", 
    "src\utils\notifications.js"
)

$brokenCount = 0
foreach ($file in $brokenFiles) {
    if (Test-Path $file) {
        $dest = Join-Path $archive "all-broken" (Split-Path $file -Leaf)
        Copy-Item $file $dest -Force
        $brokenCount++
    }
}
Write-Host "   Archived $brokenCount broken files" -ForegroundColor Green

# ============================================================================
# 4. ARCHIVE ALL TEST FILES WITH vmpAdapter
# ============================================================================
Write-Host "`n[4/8] Archiving legacy test files..." -ForegroundColor Yellow
$testFiles = Get-ChildItem -Path "tests" -Recurse -File -Include "*.test.js","*.spec.js" | 
    Where-Object { (Get-Content $_.FullName -Raw) -match "vmpAdapter|from.*supabase\.js" }

$testCount = 0
foreach ($file in $testFiles) {
    $dest = Join-Path $archive "legacy-tests-all" $file.Name
    Copy-Item $file.FullName $dest -Force
    $testCount++
}
Write-Host "   Archived $testCount test files" -ForegroundColor Green

# ============================================================================
# 5. ARCHIVE ALL SCRIPTS WITH vmp_* REFERENCES
# ============================================================================
Write-Host "`n[5/8] Archiving legacy scripts..." -ForegroundColor Yellow
$scriptFiles = Get-ChildItem -Path "scripts" -Recurse -File -Include "*.js","*.ps1","*.sh" | 
    Where-Object { (Get-Content $_.FullName -Raw) -match "vmp_|vmpAdapter" }

$scriptCount = 0
foreach ($file in $scriptFiles) {
    $dest = Join-Path $archive "legacy-scripts-all" $file.Name
    Copy-Item $file.FullName $dest -Force
    $scriptCount++
}
Write-Host "   Archived $scriptCount script files" -ForegroundColor Green

# ============================================================================
# 6. ARCHIVE ALL FILES WITH TODO/FIXME
# ============================================================================
Write-Host "`n[6/8] Archiving files with TODOs..." -ForegroundColor Yellow
$todoFiles = Get-ChildItem -Path "." -Recurse -File -Include "*.js","*.md","*.html","*.sql" | 
    Where-Object { 
        $_.FullName -notmatch "node_modules|\.git|\.archive" -and
        (Get-Content $_.FullName -Raw) -match "TODO|FIXME|HACK|STUB|PLACEHOLDER|WIP|INCOMPLETE|BROKEN|DEPRECATED"
    } | Select-Object -First 50

$todoCount = 0
foreach ($file in $todoFiles) {
    $dest = Join-Path $archive "all-todos" $file.Name
    Copy-Item $file.FullName $dest -Force
    $todoCount++
}
Write-Host "   Archived $todoCount files with TODOs" -ForegroundColor Green

# ============================================================================
# 7. ARCHIVE ALL DOCS FOLDER
# ============================================================================
Write-Host "`n[7/8] Archiving docs folder..." -ForegroundColor Yellow
if (Test-Path "docs") {
    $docFiles = Get-ChildItem -Path "docs" -Recurse -File
    $docCount = 0
    foreach ($file in $docFiles) {
        $relPath = $file.FullName.Replace((Get-Location).Path + "\docs\", "")
        $dest = Join-Path $archive "docs" $relPath
        $destDir = Split-Path $dest -Parent
        New-Item -ItemType Directory -Force -Path $destDir | Out-Null
        Copy-Item $file.FullName $dest -Force
        $docCount++
    }
    Write-Host "   Archived $docCount doc files" -ForegroundColor Green
}

# ============================================================================
# 8. CREATE SUMMARY
# ============================================================================
Write-Host "`n[8/8] Creating archive summary..." -ForegroundColor Yellow
$endTime = Get-Date
$duration = ($endTime - $startTime).TotalSeconds

$totalFiles = $mdCount + $devCount + $brokenCount + $testCount + $scriptCount + $todoCount + $docCount

$summary = @"
# DEEP ARCHIVE SUMMARY

**Date:** $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
**Duration:** $([math]::Round($duration, 2)) seconds
**Total Files Archived:** $totalFiles

## Breakdown

- Markdown Files: $mdCount
- Dev Notes: $devCount  
- Broken Files: $brokenCount
- Legacy Tests: $testCount
- Legacy Scripts: $scriptCount
- TODO Files: $todoCount
- Docs: $docCount

## Archive Locations

- All Markdown: $archive\all-markdown\
- Dev Notes: $archive\dev-notes\
- Broken Files: $archive\all-broken\
- Legacy Tests: $archive\legacy-tests-all\
- Legacy Scripts: $archive\legacy-scripts-all\
- TODO Files: $archive\all-todos\
- Docs: $archive\docs\

"@

$summary | Out-File -FilePath "$archive\DEEP_ARCHIVE_SUMMARY.md" -Encoding UTF8

Write-Host "`n=== ARCHIVE COMPLETE ===" -ForegroundColor Green
Write-Host "Total files: $totalFiles" -ForegroundColor Cyan
Write-Host "Duration: $([math]::Round($duration, 2)) seconds" -ForegroundColor Cyan
Write-Host "Location: $archive\" -ForegroundColor Yellow

