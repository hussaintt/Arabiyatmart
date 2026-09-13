#!/usr/bin/env node

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const traceability = readFileSync(join(root, 'docs/contract-traceability.md'), 'utf8');
const matrix = readFileSync(join(root, 'tests/contract/operation-matrix.ts'), 'utf8');
const localeRoot = join(root, 'src/app/[locale]');

function pageFiles(directory, segments = []) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return pageFiles(path, [...segments, entry.name]);
    if (entry.name !== 'page.tsx') return [];
    const routeSegments = segments.filter((segment) => !/^\(.+\)$/.test(segment));
    return [`/${['[locale]', ...routeSegments].join('/')}`];
  });
}

const routes = pageFiles(localeRoot);
const operations = [...matrix.matchAll(/(?:read|mutation)\('([^']+)'/g)].map((match) => match[1]);
const gates = [...matrix.matchAll(/'([A-Z]+-01)'/g)].map((match) => match[1]);
const required = [...routes, ...operations, ...gates, 'TASK-050', 'cancelled'];
const missing = required.filter((item) => !traceability.includes(item));

if (missing.length) {
  console.error(`Contract traceability check failed. Missing inventory entries:\n${missing.map((item) => `- ${item}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Contract traceability check passed (${routes.length} routes, ${operations.length} operations, ${gates.length} readiness gates).`);
}
