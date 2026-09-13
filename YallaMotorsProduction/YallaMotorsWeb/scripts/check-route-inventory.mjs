#!/usr/bin/env node

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const localeRoot = join(root, 'src/app/[locale]');

const publicRoutes = [
  '(marketplace)/page.tsx',
  '(marketplace)/search/page.tsx',
  '(marketplace)/dealers/page.tsx',
  '(marketplace)/dealers/[slug]/page.tsx',
  '(marketplace)/listing/[slug]/page.tsx',
  '(marketplace)/catalogue/makes/page.tsx',
  '(marketplace)/catalogue/makes/[makeSlug]/page.tsx',
  '(marketplace)/catalogue/models/[publicId]/page.tsx',
  '(marketplace)/catalogue/trims/[publicId]/page.tsx',
  '(marketplace)/news/page.tsx',
  '(marketplace)/privacy/page.tsx',
  '(marketplace)/terms/page.tsx',
];

const privateRoutes = [
  '(account)/best-offer/page.tsx',
  '(marketplace)/compare/page.tsx',
  '(account)/best-offer/[slug]/page.tsx',
  '(account)/favorites/page.tsx',
  '(account)/me/dashboard/page.tsx',
  '(account)/me/leads/page.tsx',
  '(account)/me/leads/[publicId]/page.tsx',
  '(account)/me/listings/page.tsx',
  '(account)/notifications/page.tsx',
  '(account)/profile/page.tsx',
  '(account)/profile/edit/page.tsx',
  '(account)/saved-searches/page.tsx',
  '(account)/sell/page.tsx',
  '(auth)/forgot-password/page.tsx',
  '(auth)/login/page.tsx',
  '(auth)/register/page.tsx',
  '(auth)/register-success/page.tsx',
  '(auth)/reset-password/page.tsx',
  '(auth)/verify-email/page.tsx',
  'forbidden/page.tsx',
];

function pageFiles(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return pageFiles(path, relativePath);
    return entry.name === 'page.tsx' ? [relativePath] : [];
  });
}

const expectedPublic = [...publicRoutes].sort();
const expectedPrivate = [...privateRoutes].sort();
const expected = [...expectedPublic, ...expectedPrivate].sort();
const actual = pageFiles(localeRoot).sort();
const missing = expected.filter((route) => !actual.includes(route));
const extra = actual.filter((route) => !expected.includes(route));
const duplicates = expected.filter((route, index) => expected.indexOf(route) !== index);
const metadataViolations = [];

for (const route of publicRoutes) {
  const source = readFileSync(join(localeRoot, route), 'utf8');
  if (!source.includes('openGraph')) metadataViolations.push(`${route}: public route must define OpenGraph metadata`);
}
for (const route of privateRoutes) {
  const source = readFileSync(join(localeRoot, route), 'utf8');
  if (!/index\s*:\s*false/.test(source)) metadataViolations.push(`${route}: private route must be noindex`);
}

if (missing.length || extra.length || duplicates.length || metadataViolations.length) {
  console.error('Route inventory check failed.');
  if (missing.length) console.error(`Missing routes:\n${missing.map((route) => `- ${route}`).join('\n')}`);
  if (extra.length) console.error(`Unexpected routes:\n${extra.map((route) => `- ${route}`).join('\n')}`);
  if (duplicates.length) console.error(`Duplicate inventory entries:\n${duplicates.map((route) => `- ${route}`).join('\n')}`);
  if (metadataViolations.length) console.error(`Metadata violations:\n${metadataViolations.map((violation) => `- ${violation}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Route inventory check passed (${actual.length} localized page routes; ${expectedPublic.length} public, ${expectedPrivate.length} private/auth).`);
}
