#!/usr/bin/env node

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = join(root, 'src');
const intentional = new Set([
  'src/lib/env/server.ts', // validates and rejects production placeholder secrets
  'src/components/home/news-placeholder.tsx', // explicit product-owned empty news state
]);
const violations = [];

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : /\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

for (const path of files(sourceRoot)) {
  const name = relative(root, path);
  if (intentional.has(name)) continue;
  const source = readFileSync(path, 'utf8');
  for (const match of source.matchAll(/\b(?:TODO|FIXME|PLACEHOLDER)\b/g)) {
    violations.push(`${name}:${source.slice(0, match.index).split('\n').length}`);
  }
}

if (violations.length) {
  console.error(`Release content check failed. Resolve placeholder markers:\n${violations.map((item) => `- ${item}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log('Release content check passed (no unresolved source markers).');
}
