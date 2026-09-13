#!/usr/bin/env node

import { existsSync, readFileSync, statSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const appManifestPath = join(root, '.next/app-build-manifest.json');
const chunkRoot = join(root, '.next/static/chunks/app');

// Monitored routes with total page budget, total JS budget, and route JS sub-budget
const routes = [
  {
    name: 'public home',
    manifestKey: '/[locale]/(marketplace)/page',
    routeChunkPattern: '/(marketplace)/page',
    maxRouteJsBytes: 160_000,
    maxTotalJsBytes: 850_000,
    maxTotalPageBytes: 1_250_000,
    criticalImages: ['public/images/home-banner.webp', 'public/images/home-banner.png'],
  },
  {
    name: 'search',
    manifestKey: '/[locale]/(marketplace)/search/page',
    routeChunkPattern: '/(marketplace)/search/page',
    maxRouteJsBytes: 180_000,
    maxTotalJsBytes: 850_000,
    maxTotalPageBytes: 1_250_000,
    criticalImages: [],
  },
  {
    name: 'listing detail',
    manifestKey: '/[locale]/(marketplace)/listing/[slug]/page',
    routeChunkPattern: '/(marketplace)/listing/[slug]/page',
    maxRouteJsBytes: 220_000,
    maxTotalJsBytes: 850_000,
    maxTotalPageBytes: 1_250_000,
    criticalImages: [],
  },
  {
    name: 'sell workflow',
    manifestKey: '/[locale]/(account)/sell/page',
    routeChunkPattern: '/(account)/sell/page',
    maxRouteJsBytes: 180_000,
    maxTotalJsBytes: 850_000,
    maxTotalPageBytes: 1_250_000,
    criticalImages: [],
  },
  {
    name: 'profile',
    manifestKey: '/[locale]/(account)/profile/page',
    routeChunkPattern: '/(account)/profile/page',
    maxRouteJsBytes: 120_000,
    maxTotalJsBytes: 850_000,
    maxTotalPageBytes: 1_250_000,
    criticalImages: [],
  },
  {
    name: 'vendor dashboard',
    manifestKey: '/[locale]/(account)/me/dashboard/page',
    routeChunkPattern: '/(account)/me/dashboard/page',
    maxRouteJsBytes: 120_000,
    maxTotalJsBytes: 850_000,
    maxTotalPageBytes: 1_250_000,
    criticalImages: [],
  },
];

function getFileSize(filePath) {
  if (!existsSync(filePath)) return 0;
  return statSync(filePath).size;
}

function findFontCost() {
  const woff2 = join(root, 'public/fonts/cairo.woff2');
  if (existsSync(woff2)) return statSync(woff2).size;
  const ttf = join(root, 'public/fonts/Cairo-VariableFont.ttf');
  if (existsSync(ttf)) return statSync(ttf).size;
  return 0;
}

function files(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return files(path);
    return path.endsWith('.js') ? [path] : [];
  });
}

const fontCost = findFontCost();
const chunks = files(chunkRoot);

let appManifest = null;
if (existsSync(appManifestPath)) {
  try {
    appManifest = JSON.parse(readFileSync(appManifestPath, 'utf8'));
  } catch {
    appManifest = null;
  }
}

const failures = [];
const reports = [];

for (const route of routes) {
  let routeJsBytes = 0;
  let sharedJsBytes = 0;
  let totalJsBytes = 0;
  let cssBytes = 0;
  let criticalImgBytes = 0;

  // 1. Critical images for this route
  for (const imgRel of route.criticalImages) {
    const imgPath = join(root, imgRel);
    if (existsSync(imgPath)) {
      criticalImgBytes += statSync(imgPath).size;
      break; // count primary image format
    }
  }

  // 2. Measure from app manifest if available
  if (appManifest && appManifest.pages && appManifest.pages[route.manifestKey]) {
    const pageChunks = appManifest.pages[route.manifestKey];
    for (const chunkRel of pageChunks) {
      const fullPath = join(root, '.next', chunkRel);
      const size = getFileSize(fullPath);
      if (chunkRel.endsWith('.css')) {
        cssBytes += size;
      } else if (chunkRel.endsWith('.js')) {
        totalJsBytes += size;
        if (chunkRel.includes(route.routeChunkPattern)) {
          routeJsBytes += size;
        } else {
          sharedJsBytes += size;
        }
      }
    }
  } else {
    // Fallback: scan filesystem chunks
    const candidates = chunks.filter((path) => path.includes(route.routeChunkPattern));
    if (candidates.length === 1) {
      routeJsBytes = statSync(candidates[0]).size;
      totalJsBytes = routeJsBytes;
    }
  }

  const totalPageCost = totalJsBytes + cssBytes + fontCost + criticalImgBytes;

  const summary = [
    `${route.name}: Total Page Cost: ${(totalPageCost / 1024).toFixed(1)}KB / ${(route.maxTotalPageBytes / 1024).toFixed(1)}KB budget`,
    `  ├─ Route JS (sub-metric): ${(routeJsBytes / 1024).toFixed(1)}KB / ${(route.maxRouteJsBytes / 1024).toFixed(1)}KB`,
    `  ├─ Shared JS: ${(sharedJsBytes / 1024).toFixed(1)}KB`,
    `  ├─ Total JS: ${(totalJsBytes / 1024).toFixed(1)}KB / ${(route.maxTotalJsBytes / 1024).toFixed(1)}KB`,
    `  ├─ CSS: ${(cssBytes / 1024).toFixed(1)}KB`,
    `  ├─ Fonts: ${(fontCost / 1024).toFixed(1)}KB`,
    `  └─ Critical Images: ${(criticalImgBytes / 1024).toFixed(1)}KB`,
  ].join('\n');

  reports.push(summary);

  if (routeJsBytes > route.maxRouteJsBytes) {
    failures.push(`${route.name}: Route JS ${routeJsBytes}B exceeds sub-budget ${route.maxRouteJsBytes}B`);
  }
  if (totalJsBytes > route.maxTotalJsBytes) {
    failures.push(`${route.name}: Total JS ${totalJsBytes}B exceeds budget ${route.maxTotalJsBytes}B`);
  }
  if (totalPageCost > route.maxTotalPageBytes) {
    failures.push(`${route.name}: Total Page Cost ${totalPageCost}B exceeds budget ${route.maxTotalPageBytes}B`);
  }
}

console.log('=== Bundle & Page Transfer Cost Report ===');
console.log(reports.join('\n\n'));
console.log('==========================================');

if (failures.length > 0) {
  console.error('\nBundle budget check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('\nAll bundle and total page transfer budgets passed.');
}
