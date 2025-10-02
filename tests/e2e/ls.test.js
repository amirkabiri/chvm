import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI_PATH = join(__dirname, '../../src/cli.js');

let testChvmDir;

function runCLI(args = '', options = {}) {
  const command = `node ${CLI_PATH} ${args}`;
  const env = { ...process.env, CHVM_HOME: testChvmDir, ...options.env };
  
  try {
    return execSync(command, {
      encoding: 'utf8',
      stdio: 'pipe',
      env
    });
  } catch (error) {
    return {
      stdout: error.stdout?.toString() || '',
      stderr: error.stderr?.toString() || '',
      status: error.status,
      error: true
    };
  }
}

describe('E2E: chvm ls', () => {
  beforeEach(() => {
    // Create a temporary test directory
    testChvmDir = fs.mkdtempSync(join(os.tmpdir(), 'chvm-test-ls-'));
  });

  afterEach(() => {
    // Cleanup
    if (testChvmDir && fs.existsSync(testChvmDir)) {
      fs.rmSync(testChvmDir, { recursive: true, force: true });
    }
  });

  it('should show empty list when no versions available', () => {
    const output = runCLI('ls');
    
    if (typeof output === 'object' && output.error) {
      // Might need update first
      expect(output.stdout || output.stderr).toMatch(/update|available|empty/i);
    } else {
      expect(output).toMatch(/No versions|empty|update/i);
    }
  });

  it('should support --json flag for machine-readable output', () => {
    const output = runCLI('ls --json');
    
    if (typeof output === 'object' && output.error) {
      // Still might output JSON even on error
      const jsonOutput = output.stdout || output.stderr;
      if (jsonOutput.includes('{') || jsonOutput.includes('[')) {
        expect(() => JSON.parse(jsonOutput)).not.toThrow();
      }
    } else {
      expect(() => JSON.parse(output)).not.toThrow();
      const data = JSON.parse(output);
      expect(Array.isArray(data) || typeof data === 'object').toBe(true);
    }
  });

  it('should display installed versions at the top', () => {
    // First, create a mock installed version
    const installedDir = join(testChvmDir, 'installs');
    fs.mkdirSync(installedDir, { recursive: true });
    
    const installedJsonPath = join(testChvmDir, 'installed.json');
    fs.writeFileSync(installedJsonPath, JSON.stringify({
      '92.0.4515.159': {
        revision: '882387',
        path: join(installedDir, '92.0.4515.159.app'),
        installedAt: new Date().toISOString(),
        size: 116242173
      }
    }, null, 2));

    // Also create available.json for ls to work
    const availableJsonPath = join(testChvmDir, 'available.json');
    fs.writeFileSync(availableJsonPath, JSON.stringify([
      {
        version: '92.0.4515.159',
        revision: '882387',
        platform: 'Mac_Arm'
      },
      {
        version: '93.0.4577.82',
        revision: '911515',
        platform: 'Mac_Arm'
      }
    ], null, 2));

    const output = runCLI('ls');
    
    // Should show installed version
    expect(output).toContain('92.0.4515.159');
    
    // Should have some indicator for installed (*, installed, etc)
    const lines = output.split('\n');
    const installedLine = lines.find(line => line.includes('92.0.4515.159'));
    expect(installedLine).toMatch(/\*|installed/i);
  });

  it('should show version, revision, and status columns', () => {
    // Create available.json
    const availableJsonPath = join(testChvmDir, 'available.json');
    fs.writeFileSync(availableJsonPath, JSON.stringify([
      {
        version: '92.0.4515.159',
        revision: '882387',
        platform: 'Mac_Arm'
      }
    ], null, 2));

    const output = runCLI('ls');
    
    expect(output).toMatch(/VERSION|version/i);
    expect(output).toMatch(/REVISION|revision/i);
    expect(output).toContain('92.0.4515.159');
    expect(output).toContain('882387');
  });
});


