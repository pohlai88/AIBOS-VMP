#!/usr/bin/env node

/**
 * Vitest Coverage Runner Script
 *
 * Wrapper script to run Vitest with coverage
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const args = ['run', 'test:coverage'];

console.log(`Running: ${command} ${args.join(' ')}`);

const child = spawn(command, args, {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    PATH: process.env.PATH || '',
  },
});

child.on('error', error => {
  console.error('Error running vitest coverage:', error);
  process.exit(1);
});

child.on('exit', code => {
  process.exit(code || 0);
});
