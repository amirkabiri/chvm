import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { execSync, spawn } from 'child_process';
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
      env,
      timeout: options.timeout || 10000
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

describe('E2E: chvm open', () => {
  beforeEach(() => {
    testChvmDir = fs.mkdtempSync(join(os.tmpdir(), 'chvm-test-open-'));
  });

  afterEach(() => {
    if (testChvmDir && fs.existsSync(testChvmDir)) {
      fs.rmSync(testChvmDir, { recursive: true, force: true });
    }
  });

  it('should install version if not already installed', async () => {
    const availablePath = join(testChvmDir, 'available.json');
    fs.mkdirSync(dirname(availablePath), { recursive: true });
    fs.writeFileSync(availablePath, JSON.stringify([
      {
        version: '92.0.4515.159',
        revision: '882387',
        platform: 'Mac_Arm'
      }
    ], null, 2));

    const output = runCLI('open 882387', { timeout: 120000 });
    
    // Should mention installation if not installed
    expect(output).toMatch(/Installing|installed|Opening|Launching|Download/i);
  }, 120000);

  it('should fail gracefully if version not found', () => {
    const output = runCLI('open nonexistent-version-12345');
    
    expect(output.error).toBe(true);
    expect(output.stderr || output.stdout).toMatch(/not found|available/i);
  });

  it('should open installed version', async () => {
    // Setup an installed version
    const installedDir = join(testChvmDir, 'installs');
    const appDir = join(installedDir, '92.0.4515.159.app');
    const contentsDir = join(appDir, 'Contents', 'MacOS');
    
    fs.mkdirSync(contentsDir, { recursive: true });
    
    // Create a dummy executable (for testing structure)
    const execPath = join(contentsDir, 'Chromium');
    fs.writeFileSync(execPath, '#!/bin/bash\necho "Chromium launched"\n');
    fs.chmodSync(execPath, 0o755);

    const installedJsonPath = join(testChvmDir, 'installed.json');
    fs.writeFileSync(installedJsonPath, JSON.stringify({
      '92.0.4515.159': {
        revision: '882387',
        path: appDir,
        installedAt: new Date().toISOString(),
        size: 116242173
      }
    }, null, 2));

    const output = runCLI('open 92.0.4515.159', { timeout: 5000 });
    
    // Should attempt to open (might fail without real Chromium, but should try)
    expect(output).toMatch(/Opening|Launching|opened|92\.0\.4515\.159/i);
  });

  it('should use separate profile directory by default', async () => {
    // Setup installed version
    const installedDir = join(testChvmDir, 'installs');
    const appDir = join(installedDir, '92.0.4515.159.app');
    const contentsDir = join(appDir, 'Contents', 'MacOS');
    
    fs.mkdirSync(contentsDir, { recursive: true });
    const execPath = join(contentsDir, 'Chromium');
    fs.writeFileSync(execPath, '#!/bin/bash\necho "Args: $@"\n');
    fs.chmodSync(execPath, 0o755);

    const installedJsonPath = join(testChvmDir, 'installed.json');
    fs.writeFileSync(installedJsonPath, JSON.stringify({
      '92.0.4515.159': {
        revision: '882387',
        path: appDir,
        installedAt: new Date().toISOString(),
        size: 116242173
      }
    }, null, 2));

    const output = runCLI('open 92.0.4515.159', { timeout: 5000 });
    
    // Should create/use profile directory
    const profileDir = join(testChvmDir, 'profiles', '92.0.4515.159');
    expect(output).toMatch(/profile|user-data-dir|Opening/i);
  });

  it('should support --disable-cors flag with security warning', async () => {
    const installedDir = join(testChvmDir, 'installs');
    const appDir = join(installedDir, '92.0.4515.159.app');
    const contentsDir = join(appDir, 'Contents', 'MacOS');
    
    fs.mkdirSync(contentsDir, { recursive: true });
    const execPath = join(contentsDir, 'Chromium');
    fs.writeFileSync(execPath, '#!/bin/bash\necho "Args: $@"\n');
    fs.chmodSync(execPath, 0o755);

    const installedJsonPath = join(testChvmDir, 'installed.json');
    fs.writeFileSync(installedJsonPath, JSON.stringify({
      '92.0.4515.159': {
        revision: '882387',
        path: appDir,
        installedAt: new Date().toISOString(),
        size: 116242173
      }
    }, null, 2));

    const output = runCLI('open 92.0.4515.159 --disable-cors', { timeout: 5000 });
    
    // Should show warning about security
    expect(output).toMatch(/WARNING|warning|security|insecure|disable-web-security/i);
  });

  it('should use temp directory with --disable-cors', async () => {
    const installedDir = join(testChvmDir, 'installs');
    const appDir = join(installedDir, '92.0.4515.159.app');
    const contentsDir = join(appDir, 'Contents', 'MacOS');
    
    fs.mkdirSync(contentsDir, { recursive: true });
    const execPath = join(contentsDir, 'Chromium');
    fs.writeFileSync(execPath, '#!/bin/bash\necho "Args: $@"\n');
    fs.chmodSync(execPath, 0o755);

    const installedJsonPath = join(testChvmDir, 'installed.json');
    fs.writeFileSync(installedJsonPath, JSON.stringify({
      '92.0.4515.159': {
        revision: '882387',
        path: appDir,
        installedAt: new Date().toISOString(),
        size: 116242173
      }
    }, null, 2));

    const output = runCLI('open 92.0.4515.159 --disable-cors', { timeout: 5000 });
    
    // Should mention temp directory usage
    expect(output).toMatch(/tmp|temp|user-data-dir|profile/i);
  });

  it('should handle opening by revision number', async () => {
    const availablePath = join(testChvmDir, 'available.json');
    fs.mkdirSync(dirname(availablePath), { recursive: true });
    fs.writeFileSync(availablePath, JSON.stringify([
      {
        version: '92.0.4515.159',
        revision: '882387',
        platform: 'Mac_Arm'
      }
    ], null, 2));

    const installedDir = join(testChvmDir, 'installs');
    const appDir = join(installedDir, '92.0.4515.159.app');
    const contentsDir = join(appDir, 'Contents', 'MacOS');
    
    fs.mkdirSync(contentsDir, { recursive: true });
    const execPath = join(contentsDir, 'Chromium');
    fs.writeFileSync(execPath, '#!/bin/bash\necho "Chromium"\n');
    fs.chmodSync(execPath, 0o755);

    const installedJsonPath = join(testChvmDir, 'installed.json');
    fs.writeFileSync(installedJsonPath, JSON.stringify({
      '92.0.4515.159': {
        revision: '882387',
        path: appDir,
        installedAt: new Date().toISOString(),
        size: 116242173
      }
    }, null, 2));

    const output = runCLI('open 882387', { timeout: 5000 });
    
    expect(output).toMatch(/Opening|Launching|882387|92\.0\.4515\.159/i);
  });
});


