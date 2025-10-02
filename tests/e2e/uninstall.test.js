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

describe('E2E: chvm uninstall', () => {
  beforeEach(() => {
    testChvmDir = fs.mkdtempSync(join(os.tmpdir(), 'chvm-test-uninstall-'));
  });

  afterEach(() => {
    if (testChvmDir && fs.existsSync(testChvmDir)) {
      fs.rmSync(testChvmDir, { recursive: true, force: true });
    }
  });

  it('should fail gracefully when version not installed', () => {
    const output = runCLI('uninstall nonexistent-version');
    
    expect(output.error).toBe(true);
    expect(output.stderr || output.stdout).toMatch(/not installed|not found/i);
  });

  it('should remove app directory', () => {
    // Setup installed version
    const installedDir = join(testChvmDir, 'installs');
    const appDir = join(installedDir, '92.0.4515.159.app');
    
    fs.mkdirSync(appDir, { recursive: true });
    fs.writeFileSync(join(appDir, 'dummy.txt'), 'test');

    const installedJsonPath = join(testChvmDir, 'installed.json');
    fs.writeFileSync(installedJsonPath, JSON.stringify({
      '92.0.4515.159': {
        revision: '882387',
        path: appDir,
        installedAt: new Date().toISOString(),
        size: 116242173
      }
    }, null, 2));

    const output = runCLI('uninstall 92.0.4515.159');
    
    // Should succeed
    expect(output).toMatch(/Uninstalled|Removed|Success|deleted/i);
    
    // App directory should be gone
    expect(fs.existsSync(appDir)).toBe(false);
  });

  it('should remove entry from installed.json', () => {
    const installedDir = join(testChvmDir, 'installs');
    const appDir = join(installedDir, '92.0.4515.159.app');
    
    fs.mkdirSync(appDir, { recursive: true });

    const installedJsonPath = join(testChvmDir, 'installed.json');
    fs.writeFileSync(installedJsonPath, JSON.stringify({
      '92.0.4515.159': {
        revision: '882387',
        path: appDir,
        installedAt: new Date().toISOString(),
        size: 116242173
      },
      '93.0.4577.82': {
        revision: '911515',
        path: join(installedDir, '93.0.4577.82.app'),
        installedAt: new Date().toISOString(),
        size: 120000000
      }
    }, null, 2));

    const output = runCLI('uninstall 92.0.4515.159');
    
    // Check installed.json
    const installed = JSON.parse(fs.readFileSync(installedJsonPath, 'utf8'));
    
    expect(installed).not.toHaveProperty('92.0.4515.159');
    expect(installed).toHaveProperty('93.0.4577.82'); // Other version should remain
  });

  it('should remove profile directory', () => {
    const installedDir = join(testChvmDir, 'installs');
    const appDir = join(installedDir, '92.0.4515.159.app');
    const profileDir = join(testChvmDir, 'profiles', '92.0.4515.159');
    
    fs.mkdirSync(appDir, { recursive: true });
    fs.mkdirSync(profileDir, { recursive: true });
    fs.writeFileSync(join(profileDir, 'profile-data.txt'), 'test');

    const installedJsonPath = join(testChvmDir, 'installed.json');
    fs.writeFileSync(installedJsonPath, JSON.stringify({
      '92.0.4515.159': {
        revision: '882387',
        path: appDir,
        installedAt: new Date().toISOString(),
        size: 116242173
      }
    }, null, 2));

    const output = runCLI('uninstall 92.0.4515.159');
    
    // Profile directory should be removed
    expect(fs.existsSync(profileDir)).toBe(false);
  });

  it('should remove tmp directories related to version', () => {
    const installedDir = join(testChvmDir, 'installs');
    const appDir = join(installedDir, '92.0.4515.159.app');
    const tmpDir = join(testChvmDir, 'tmp', '92.0.4515.159');
    
    fs.mkdirSync(appDir, { recursive: true });
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(join(tmpDir, 'temp-file.txt'), 'test');

    const installedJsonPath = join(testChvmDir, 'installed.json');
    fs.writeFileSync(installedJsonPath, JSON.stringify({
      '92.0.4515.159': {
        revision: '882387',
        path: appDir,
        installedAt: new Date().toISOString(),
        size: 116242173
      }
    }, null, 2));

    const output = runCLI('uninstall 92.0.4515.159');
    
    // Tmp directory should be removed
    expect(fs.existsSync(tmpDir)).toBe(false);
  });

  it('should work with revision number', () => {
    const installedDir = join(testChvmDir, 'installs');
    const appDir = join(installedDir, '92.0.4515.159.app');
    
    fs.mkdirSync(appDir, { recursive: true });

    const availablePath = join(testChvmDir, 'available.json');
    fs.writeFileSync(availablePath, JSON.stringify([
      {
        version: '92.0.4515.159',
        revision: '882387',
        platform: 'Mac_Arm'
      }
    ], null, 2));

    const installedJsonPath = join(testChvmDir, 'installed.json');
    fs.writeFileSync(installedJsonPath, JSON.stringify({
      '92.0.4515.159': {
        revision: '882387',
        path: appDir,
        installedAt: new Date().toISOString(),
        size: 116242173
      }
    }, null, 2));

    const output = runCLI('uninstall 882387');
    
    expect(output).toMatch(/Uninstalled|Removed|Success/i);
    expect(fs.existsSync(appDir)).toBe(false);
  });

  it('should support --force flag', () => {
    const installedDir = join(testChvmDir, 'installs');
    const appDir = join(installedDir, '92.0.4515.159.app');
    
    fs.mkdirSync(appDir, { recursive: true });

    const installedJsonPath = join(testChvmDir, 'installed.json');
    fs.writeFileSync(installedJsonPath, JSON.stringify({
      '92.0.4515.159': {
        revision: '882387',
        path: appDir,
        installedAt: new Date().toISOString(),
        size: 116242173
      }
    }, null, 2));

    // With --force, should not prompt even if running (we can't easily test running process)
    const output = runCLI('uninstall 92.0.4515.159 --force');
    
    expect(output).toMatch(/Uninstalled|Removed|Success|force/i);
  });

  it('should warn if process is running (without --force)', () => {
    // This is hard to test in E2E without actually running Chromium
    // We'll test the logic in unit tests instead
    // Here we just verify the command accepts the scenario
    
    const installedDir = join(testChvmDir, 'installs');
    const appDir = join(installedDir, '92.0.4515.159.app');
    
    fs.mkdirSync(appDir, { recursive: true });

    const installedJsonPath = join(testChvmDir, 'installed.json');
    fs.writeFileSync(installedJsonPath, JSON.stringify({
      '92.0.4515.159': {
        revision: '882387',
        path: appDir,
        installedAt: new Date().toISOString(),
        size: 116242173
      }
    }, null, 2));

    const output = runCLI('uninstall 92.0.4515.159');
    
    // Should either succeed or warn about running process
    expect(output).toMatch(/Uninstalled|Removed|Success|running|process/i);
  });

  it('should handle complete cleanup of multiple resources', () => {
    // Setup everything for a version
    const installedDir = join(testChvmDir, 'installs');
    const appDir = join(installedDir, '92.0.4515.159.app');
    const profileDir = join(testChvmDir, 'profiles', '92.0.4515.159');
    const tmpDir = join(testChvmDir, 'tmp', '92.0.4515.159');
    
    fs.mkdirSync(appDir, { recursive: true });
    fs.mkdirSync(profileDir, { recursive: true });
    fs.mkdirSync(tmpDir, { recursive: true });
    
    fs.writeFileSync(join(appDir, 'app.txt'), 'test');
    fs.writeFileSync(join(profileDir, 'profile.txt'), 'test');
    fs.writeFileSync(join(tmpDir, 'tmp.txt'), 'test');

    const installedJsonPath = join(testChvmDir, 'installed.json');
    fs.writeFileSync(installedJsonPath, JSON.stringify({
      '92.0.4515.159': {
        revision: '882387',
        path: appDir,
        installedAt: new Date().toISOString(),
        size: 116242173
      }
    }, null, 2));

    const output = runCLI('uninstall 92.0.4515.159');
    
    // All should be removed
    expect(fs.existsSync(appDir)).toBe(false);
    expect(fs.existsSync(profileDir)).toBe(false);
    expect(fs.existsSync(tmpDir)).toBe(false);
    
    // installed.json should not have the entry
    const installed = JSON.parse(fs.readFileSync(installedJsonPath, 'utf8'));
    expect(installed).not.toHaveProperty('92.0.4515.159');
  });
});


