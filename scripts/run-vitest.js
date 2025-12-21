#!/usr/bin/env node

/**
 * Vitest Runner Script
 * 
 * Wrapper script to run Vitest with proper PATH resolution
 * This helps MCP tools and other processes that might have PATH issues
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Get command line arguments
const args = process.argv.slice(2);

// Use npm to run vitest (more reliable than npx)
const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const vitestArgs = ['run', 'test', ...args];

console.log(`Running: ${command} ${vitestArgs.join(' ')}`);

const child = spawn(command, vitestArgs, {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    // Ensure Node.js is in PATH
    PATH: process.env.PATH || '',
  },
});

child.on('error', (error) => {
  console.error('Error running vitest:', error);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});

