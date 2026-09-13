#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, normalize, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = join(root, 'src');
const sourceExtensions = ['.ts', '.tsx', '.js', '.jsx'];
const sourceExtSet = new Set(sourceExtensions);

const FORBIDDEN_PATTERNS = [
  { match: (s) => s === 'server-only', reason: 'server-only marker' },
  { match: (s) => /(?:^|\/)lib\/env\/server(?:\.|$)/.test(s), reason: 'server environment validation' },
  { match: (s) => /(?:^|\/)lib\/api\/server(?:\.|$)/.test(s), reason: 'server-only API transport' },
  { match: (s) => /(?:^|\/)lib\/auth\/(?:cookies|csrf|edge-jwt|jwt|refresh|session)(?:\.|$)/.test(s), reason: 'server authentication primitive' },
];

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return walk(path);
    return sourceExtSet.has(extname(entry.name)) ? [path] : [];
  });
}

function resolveSpecifier(fromFile, specifier) {
  let candidate = null;
  if (specifier.startsWith('@/')) {
    candidate = resolve(sourceRoot, specifier.slice(2));
  } else if (specifier.startsWith('.')) {
    candidate = resolve(dirname(fromFile), specifier);
  } else {
    return null; // external module (e.g. 'server-only', 'react')
  }

  const options = [
    candidate,
    ...sourceExtensions.map((ext) => `${candidate}${ext}`),
    ...sourceExtensions.map((ext) => join(candidate, `index${ext}`)),
  ];

  return options.find((opt) => existsSync(opt)) ?? null;
}

const astCache = new Map();

function getParsedFile(filePath) {
  if (astCache.has(filePath)) return astCache.get(filePath);

  const content = readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') || filePath.endsWith('.jsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  let isClient = false;
  let isServer = false;

  for (const stmt of sourceFile.statements) {
    if (ts.isExpressionStatement(stmt) && ts.isStringLiteral(stmt.expression)) {
      if (stmt.expression.text === 'use client') isClient = true;
      if (stmt.expression.text === 'use server') isServer = true;
    } else {
      break;
    }
  }

  // Also check leading comments/directives
  if (!isClient && /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*['"]use client['"]/.test(content)) {
    isClient = true;
  }
  if (!isServer && /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*['"]use server['"]/.test(content)) {
    isServer = true;
  }

  const nonTypeImports = [];
  const envAccesses = [];

  function visit(node) {
    // 1. ImportDeclaration: check if type-only
    if (ts.isImportDeclaration(node)) {
      const isTypeOnly = node.importClause?.isTypeOnly ?? false;
      const specifier = node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)
        ? node.moduleSpecifier.text
        : null;

      if (specifier && !isTypeOnly) {
        // If there are named bindings, check if all individual bindings are type-only
        let allNamedAreTypeOnly = false;
        if (node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
          const elements = node.importClause.namedBindings.elements;
          if (elements.length > 0 && elements.every((el) => el.isTypeOnly)) {
            allNamedAreTypeOnly = true;
          }
        }

        if (!allNamedAreTypeOnly) {
          nonTypeImports.push({ specifier, node });
        }
      }
    }

    // 2. ExportDeclaration with specifier (re-exports): e.g. export { x } from './foo' or export * from './foo'
    if (ts.isExportDeclaration(node)) {
      const isTypeOnly = node.isTypeOnly;
      const specifier = node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)
        ? node.moduleSpecifier.text
        : null;

      if (specifier && !isTypeOnly) {
        nonTypeImports.push({ specifier, node });
      }
    }

    // 3. Dynamic import: import('...')
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      nonTypeImports.push({ specifier: node.arguments[0].text, node });
    }

    // 4. process.env access
    if (ts.isPropertyAccessExpression(node)) {
      if (
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === 'process' &&
        node.expression.name.text === 'env' &&
        ts.isIdentifier(node.name)
      ) {
        const envVarName = node.name.text;
        if (!envVarName.startsWith('NEXT_PUBLIC_') && envVarName !== 'NODE_ENV') {
          envAccesses.push(envVarName);
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  const parsed = {
    filePath,
    isClient,
    isServer,
    nonTypeImports,
    envAccesses,
  };

  astCache.set(filePath, parsed);
  return parsed;
}

function isServerActionBoundary(filePath) {
  const rel = normalize(relative(sourceRoot, filePath));
  if (rel.startsWith('server/actions/')) return true;
  const parsed = getParsedFile(filePath);
  return parsed.isServer;
}

const allFiles = walk(sourceRoot);
const violations = [];

for (const file of allFiles) {
  const parsed = getParsedFile(file);
  if (!parsed.isClient) continue;

  const visited = new Set();
  const queue = [{ path: [file], target: file }];

  while (queue.length > 0) {
    const { path: currentPath, target: currentFile } = queue.shift();
    if (visited.has(currentFile)) continue;
    visited.add(currentFile);

    const currentParsed = getParsedFile(currentFile);

    // If current file is an intentional Server Action boundary, do not traverse its implementation
    if (currentFile !== file && isServerActionBoundary(currentFile)) {
      continue;
    }

    // Check process.env non-public access in client component graph
    for (const envVar of currentParsed.envAccesses) {
      const trail = currentPath.map((p) => relative(root, p)).join(' -> ');
      violations.push(`${trail}: non-public environment variable access: process.env.${envVar}`);
    }

    // Check non-type imports/exports
    for (const { specifier } of currentParsed.nonTypeImports) {
      // 1. Direct forbidden check against specifier
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.match(specifier)) {
          const trail = [...currentPath.map((p) => relative(root, p)), specifier].join(' -> ');
          violations.push(`${trail}: ${pattern.reason}`);
        }
      }

      // 2. Resolve local file
      const resolved = resolveSpecifier(currentFile, specifier);
      if (resolved) {
        // Also check if resolved path matches forbidden patterns
        const relResolved = relative(sourceRoot, resolved).replace(/\\/g, '/');
        for (const pattern of FORBIDDEN_PATTERNS) {
          if (pattern.match(relResolved)) {
            const trail = [...currentPath.map((p) => relative(root, p)), relative(root, resolved)].join(' -> ');
            violations.push(`${trail}: ${pattern.reason}`);
          }
        }

        queue.push({
          path: [...currentPath, resolved],
          target: resolved,
        });
      }
    }
  }
}

const uniqueViolations = [...new Set(violations)].sort();
if (uniqueViolations.length > 0) {
  console.error('Client boundary check failed:');
  for (const violation of uniqueViolations) {
    console.error(`- ${violation}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Client boundary check passed (${allFiles.length} source files scanned via TypeScript AST).`);
}
