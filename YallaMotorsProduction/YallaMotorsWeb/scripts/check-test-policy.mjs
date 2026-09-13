#!/usr/bin/env node

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const testRoot = join(root, 'tests');
const violations = [];

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : /\.(?:ts|tsx|mjs)$/.test(entry.name) ? [path] : [];
  });
}

for (const path of files(testRoot)) {
  const source = readFileSync(path, 'utf8');
  for (const pattern of [/\b(?:describe|it|test)\.(?:only|skip|todo)\s*\(/g, /\b(?:xdescribe|xit|xtest)\s*\(/g]) {
    for (const match of source.matchAll(pattern)) {
      const line = source.slice(0, match.index).split('\n').length;
      violations.push(`${path.slice(root.length + 1)}:${line} focused or disabled test`);
    }
  }
}

if (violations.length) {
  console.error(`Test policy check failed:\n${violations.map((item) => `- ${item}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log('Test policy check passed (no only/skip/todo tests).');
}
