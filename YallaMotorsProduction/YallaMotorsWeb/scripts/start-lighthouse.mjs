#!/usr/bin/env node

import { spawn } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const env = {
  ...process.env,
  NODE_ENV: 'production',
  APP_ENV: 'test',
  SITE_ORIGIN: 'http://127.0.0.1:3100',
  NEXT_PUBLIC_SITE_ORIGIN: 'http://127.0.0.1:3100',
  BACKEND_API_ORIGIN: 'http://127.0.0.1:3200',
  NEXT_PUBLIC_API_BASE_URL: 'http://127.0.0.1:3100',
  MEDIA_CDN_ORIGIN: 'http://127.0.0.1:3100',
  NEXT_PUBLIC_MEDIA_CDN_ORIGIN: 'http://127.0.0.1:3100',
  NEXT_PUBLIC_APP_ENV: 'test',
};

let nextProcess;
let shuttingDown = false;

const mockProcess = spawn(process.execPath, ['tests/e2e/mock-backend.mjs'], {
  cwd: process.cwd(),
  env,
  stdio: 'inherit',
});

function stop() {
  if (shuttingDown) return;
  shuttingDown = true;
  nextProcess?.kill('SIGTERM');
  mockProcess.kill('SIGTERM');
}

process.on('SIGINT', () => {
  stop();
  process.exitCode = 130;
});
process.on('SIGTERM', () => {
  stop();
  process.exitCode = 143;
});

const buildProcess = spawn(npmCommand, ['run', 'build:e2e'], {
  cwd: process.cwd(),
  env,
  stdio: 'inherit',
});

buildProcess.on('exit', (code, signal) => {
  if (code !== 0 || signal || shuttingDown) {
    stop();
    if (!shuttingDown) process.exitCode = code ?? 1;
    return;
  }

  nextProcess = spawn(npmCommand, ['run', 'start', '--', '--hostname', '127.0.0.1', '--port', '3100'], {
    cwd: process.cwd(),
    env,
    stdio: 'inherit',
  });

  nextProcess.on('exit', (nextCode, nextSignal) => {
    stop();
    if (!shuttingDown) process.exitCode = nextCode ?? (nextSignal ? 1 : 0);
  });
});
