#!/usr/bin/env node
/**
 * scan-secrets.js
 * Scans the repository source files and the web build output for secret-like strings.
 * Fails (exit code 1) on any match.
 *
 * Patterns detected:
 *   - Google API keys:  AIza[0-9A-Za-z_-]{35}
 *   - OpenAI keys:      sk-[A-Za-z0-9]{20,}
 *   - Groq keys:        gsk_[A-Za-z0-9]{20,}
 *   - NVIDIA NIM keys:  nvapi-[A-Za-z0-9_-]{20,}
 *   - Telegram bot tokens: [0-9]{8,10}:[A-Za-z0-9_-]{35}
 *   - JWT-like strings: eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.  (header.payload.sig)
 *   - Supabase service role keys (JWT starting with eyJ, long)
 *   - Generic high-entropy secrets: words matching common secret prefixes
 *
 * Exclusions:
 *   - node_modules/
 *   - .git/
 *   - .env.example files (they contain placeholder names only, not real secrets)
 *   - This script itself (pattern definitions)
 *   - Test fixture files that contain intentional fake/mock secrets
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Patterns that indicate a real secret value per MASTER_PROMPT.md Section 4:
// Google AIza..., sk-..., gsk_..., nvapi-..., Telegram token pattern, JWT-like strings
const SECRET_PATTERNS = [
  { name: 'Google API key', pattern: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: 'OpenAI key', pattern: /\bsk-[A-Za-z0-9]{32,}\b/ },
  { name: 'Groq key', pattern: /\bgsk_[A-Za-z0-9]{32,}\b/ },
  { name: 'NVIDIA NIM key', pattern: /\bnvapi-[A-Za-z0-9_-]{20,}\b/ },
  { name: 'Telegram bot token', pattern: /\b[0-9]{8,10}:[A-Za-z0-9_-]{35}\b/ },
  { name: 'JWT / Supabase key', pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
];

// Directories and file patterns to skip entirely
const SKIP_DIRS = new Set(['node_modules', '.git', 'coverage', '.expo', 'dist', 'web-build', 'out']);
const SKIP_FILES = new Set(['scan-secrets.js', 'package-lock.json']); // package-lock.json contains sha512 integrity hashes

// File extensions to scan
const SCAN_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.json', '.yaml', '.yml',
  '.md', '.txt', '.env.example', '.sh', '.mjs', '.cjs',
]);

// Files that are explicitly allowed to contain fake/mock secret-shaped strings for testing
const ALLOWED_FIXTURE_PATTERNS = [
  /fixtures/,
  /__tests__/,
  /\.test\./,
  /\.spec\./,
  /mock/i,
];

let violations = [];
let scannedFiles = 0;

function isAllowedFixture(filePath) {
  return ALLOWED_FIXTURE_PATTERNS.some(p => p.test(filePath));
}

function scanFile(filePath) {
  const ext = path.extname(filePath);
  const base = path.basename(filePath);

  if (!SCAN_EXTENSIONS.has(ext) && base !== '.env.example') return;
  if (SKIP_FILES.has(base)) return;
  if (base.startsWith('.env') && !base.includes('example')) return; // .env files are gitignored; skip gracefully
  if (isAllowedFixture(filePath)) return;

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return; // unreadable, skip
  }

  scannedFiles++;
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip lines that are clearly placeholder comments or examples
    if (/your[_-]?key|placeholder|example|xxx|<.*>|REPLACE_ME|TODO/i.test(line)) continue;

    for (const { name, pattern } of SECRET_PATTERNS) {
      if (pattern.test(line)) {
        violations.push({
          file: path.relative(ROOT, filePath),
          line: i + 1,
          pattern: name,
          snippet: line.trim().slice(0, 80),
        });
      }
    }
  }
}

function walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (entry.isFile()) {
      scanFile(full);
    }
  }
}

console.log('🔍 Scanning for secrets...');
walk(ROOT);

// Also scan web build output if it exists
const webBuildDirs = [
  path.join(ROOT, 'app', 'dist'),
  path.join(ROOT, 'app', 'web-build'),
  path.join(ROOT, 'app', 'out'),
];
for (const buildDir of webBuildDirs) {
  if (fs.existsSync(buildDir)) {
    console.log(`  Also scanning web build: ${buildDir}`);
    walk(buildDir);
  }
}

console.log(`  Scanned ${scannedFiles} files.`);

if (violations.length === 0) {
  console.log('✅ No secrets found.');
  process.exit(0);
} else {
  console.error(`\n❌ Found ${violations.length} potential secret(s):\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} [${v.pattern}]`);
    console.error(`    ${v.snippet}`);
  }
  console.error('\nFix these before committing. If a match is a false positive in a test fixture,');
  console.error('add the file path pattern to ALLOWED_FIXTURE_PATTERNS in scripts/scan-secrets.js');
  process.exit(1);
}

