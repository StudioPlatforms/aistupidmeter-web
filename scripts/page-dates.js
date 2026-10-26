#!/usr/bin/env node
/*
 * Writes lib/page-dates.json: { "<path>": "<ISO commit date>" } for every entry of STATIC_ROUTES
 * in lib/seo-routes.ts, from `git log -1 --format=%cI -- <file>`. A file git has no commit for
 * (new, uncommitted) falls back to its mtime; a file that does not exist yet is left out, and
 * lib/seo-routes.ts pageDate() then returns undefined so the sitemap omits lastmod for it.
 *
 * Runs before every build (package.json "prebuild"). No dependencies. Commit the output.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const routesFile = path.join(root, 'lib', 'seo-routes.ts');
const outFile = path.join(root, 'lib', 'page-dates.json');

const src = fs.readFileSync(routesFile, 'utf8');
const start = src.indexOf('export const STATIC_ROUTES');
if (start < 0) {
  console.error('page-dates: STATIC_ROUTES not found in lib/seo-routes.ts');
  process.exit(1);
}
const end = src.indexOf('\n];', start);
const block = src.slice(start, end < 0 ? undefined : end);

const pairs = [];
const re = /path:\s*'([^']+)'\s*,\s*file:\s*'([^']+)'/g;
let m;
while ((m = re.exec(block)) !== null) pairs.push({ route: m[1], file: m[2] });

function commitDate(file) {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', file], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
    return out || null;
  } catch {
    return null;
  }
}

const dates = {};
let fromGit = 0, fromMtime = 0, missing = 0;
for (const { route, file } of pairs) {
  const abs = path.join(root, file);
  if (!fs.existsSync(abs)) { missing++; continue; }
  const iso = commitDate(file);
  if (iso) {
    dates[route] = new Date(iso).toISOString();
    fromGit++;
  } else {
    dates[route] = fs.statSync(abs).mtime.toISOString();
    fromMtime++;
  }
}

const sorted = {};
for (const k of Object.keys(dates).sort()) sorted[k] = dates[k];
fs.writeFileSync(outFile, JSON.stringify(sorted, null, 2) + '\n');
console.log(`page-dates: ${Object.keys(sorted).length} pages (${fromGit} from git, ${fromMtime} from mtime, ${missing} not built yet) → lib/page-dates.json`);
