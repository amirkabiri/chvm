import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI_PATH = join(__dirname, '../../src/cli.js');

/**
 * Helper function to execute CLI commands
 */
function runCLI(args = '', options = {}) {
  const command = `node ${CLI_PATH} ${args}`;
  try {
    return execSync(command, {
      encoding: 'utf8',
      stdio: 'pipe',
      ...options
    });
  } catch (error) {
    // Return error output for testing
    return {
      stdout: error.stdout?.toString() || '',
      stderr: error.stderr?.toString() || '',
      status: error.status,
      error: true
    };
  }
}

describe('E2E: chvm help', () => {
  it('should display help when no arguments provided', () => {
    const output = runCLI('');
    expect(output).toContain('chvm');
    expect(output).toContain('Chrome Version Manager');
    expect(output).toContain('ls');
    expect(output).toContain('update');
    expect(output).toContain('install');
    expect(output).toContain('open');
    expect(output).toContain('uninstall');
  });

  it('should display help with "help" command', () => {
    const output = runCLI('help');
    expect(output).toContain('chvm');
    expect(output).toContain('Usage');
  });

  it('should display help with "--help" flag', () => {
    const output = runCLI('--help');
    expect(output).toContain('chvm');
    expect(output).toContain('Usage');
  });

  it('should display version with "--version" flag', () => {
    const output = runCLI('--version');
    expect(output).toMatch(/\d+\.\d+\.\d+/);
  });
});


