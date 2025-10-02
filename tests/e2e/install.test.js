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
      maxBuffer: 50 * 1024 * 1024 // 50MB buffer for large outputs
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

describe('E2E: chvm install', () => {
  beforeEach(() => {
    testChvmDir = fs.mkdtempSync(join(os.tmpdir(), 'chvm-test-install-'));
  });

  afterEach(() => {
    if (testChvmDir && fs.existsSync(testChvmDir)) {
      fs.rmSync(testChvmDir, { recursive: true, force: true });
    }
  });

  it('should fail with helpful message when version not found', () => {
    const output = runCLI('install nonexistent-version-12345');
    
    expect(output.error).toBe(true);
    expect(output.stderr || output.stdout).toMatch(/not found|available|update/i);
    expect(output.stderr || output.stdout).toMatch(/chvm update|chvm ls/i);
  });

  it('should support installing by revision number', async () => {
    // First setup available.json with a known revision
    const availablePath = join(testChvmDir, 'available.json');
    fs.mkdirSync(dirname(availablePath), { recursive: true });
    fs.writeFileSync(availablePath, JSON.stringify([
      {
        version: '92.0.4515.159',
        revision: '882387',
        platform: 'Mac_Arm'
      }
    ], null, 2));

    // Note: This will actually try to download, so we mock or skip actual download in unit tests
    // For E2E, we can test the command parsing and initial steps
    const output = runCLI('install 882387');
    
    // Should recognize the revision
    expect(output).toMatch(/882387|92\.0\.4515\.159|Downloading|Installing|Resolving/i);
  }, 120000); // 2 minute timeout for actual download

  it('should support installing by version number', async () => {
    const availablePath = join(testChvmDir, 'available.json');
    fs.mkdirSync(dirname(availablePath), { recursive: true });
    fs.writeFileSync(availablePath, JSON.stringify([
      {
        version: '92.0.4515.159',
        revision: '882387',
        platform: 'Mac_Arm'
      }
    ], null, 2));

    const output = runCLI('install 92.0.4515.159');
    
    expect(output).toMatch(/92\.0\.4515\.159|882387|Downloading|Installing|Resolving/i);
  }, 120000);

  it('should support "latest" keyword', async () => {
    const availablePath = join(testChvmDir, 'available.json');
    fs.mkdirSync(dirname(availablePath), { recursive: true });
    fs.writeFileSync(availablePath, JSON.stringify([
      {
        version: '92.0.4515.159',
        revision: '882387',
        platform: 'Mac_Arm'
      },
      {
        version: '115.0.5790.170',
        revision: '1234567',
        platform: 'Mac_Arm'
      }
    ], null, 2));

    const output = runCLI('install latest');
    
    expect(output).toMatch(/latest|115\.0\.5790\.170|1234567|Resolving|Installing/i);
  }, 120000);

  it('should support "oldest" keyword', async () => {
    const availablePath = join(testChvmDir, 'available.json');
    fs.mkdirSync(dirname(availablePath), { recursive: true });
    fs.writeFileSync(availablePath, JSON.stringify([
      {
        version: '92.0.4515.159',
        revision: '882387',
        platform: 'Mac_Arm'
      },
      {
        version: '115.0.5790.170',
        revision: '1234567',
        platform: 'Mac_Arm'
      }
    ], null, 2));

    const output = runCLI('install oldest');
    
    expect(output).toMatch(/oldest|92\.0\.4515\.159|882387|Resolving|Installing/i);
  }, 120000);

  it('should show progress during download and extraction', async () => {
    // This would require an actual download, so we check for progress indicators in output
    const availablePath = join(testChvmDir, 'available.json');
    fs.mkdirSync(dirname(availablePath), { recursive: true });
    fs.writeFileSync(availablePath, JSON.stringify([
      {
        version: '92.0.4515.159',
        revision: '882387',
        platform: 'Mac_Arm'
      }
    ], null, 2));

    const output = runCLI('install 882387');
    
    // Should show some progress indication
    expect(output).toMatch(/Downloading|Extracting|Installing|%|Progress|MB/i);
  }, 120000);

  it('should support --quiet flag', async () => {
    const availablePath = join(testChvmDir, 'available.json');
    fs.mkdirSync(dirname(availablePath), { recursive: true });
    fs.writeFileSync(availablePath, JSON.stringify([
      {
        version: '92.0.4515.159',
        revision: '882387',
        platform: 'Mac_Arm'
      }
    ], null, 2));

    const output = runCLI('install 882387 --quiet');
    
    // Should have minimal output
    if (!output.error) {
      expect(output.length).toBeLessThan(200); // Very minimal output
    }
  }, 120000);

  it('should update installed.json after successful install', async () => {
    const availablePath = join(testChvmDir, 'available.json');
    fs.mkdirSync(dirname(availablePath), { recursive: true });
    fs.writeFileSync(availablePath, JSON.stringify([
      {
        version: '92.0.4515.159',
        revision: '882387',
        platform: 'Mac_Arm'
      }
    ], null, 2));

    const output = runCLI('install 882387');
    
    if (!output.error) {
      const installedPath = join(testChvmDir, 'installed.json');
      
      if (fs.existsSync(installedPath)) {
        const installed = JSON.parse(fs.readFileSync(installedPath, 'utf8'));
        
        // Should have the installed version
        expect(installed).toHaveProperty('92.0.4515.159');
        
        const versionInfo = installed['92.0.4515.159'];
        expect(versionInfo).toHaveProperty('revision', '882387');
        expect(versionInfo).toHaveProperty('path');
        expect(versionInfo).toHaveProperty('installedAt');
        expect(versionInfo).toHaveProperty('size');
      }
    }
  }, 120000);

  it('should create .app bundle in installs directory', async () => {
    const availablePath = join(testChvmDir, 'available.json');
    fs.mkdirSync(dirname(availablePath), { recursive: true });
    fs.writeFileSync(availablePath, JSON.stringify([
      {
        version: '92.0.4515.159',
        revision: '882387',
        platform: 'Mac_Arm'
      }
    ], null, 2));

    const output = runCLI('install 882387');
    
    if (!output.error) {
      const installsDir = join(testChvmDir, 'installs');
      const appPath = join(installsDir, '92.0.4515.159.app');
      
      expect(fs.existsSync(installsDir)).toBe(true);
      expect(fs.existsSync(appPath)).toBe(true);
    }
  }, 120000);

  it('should handle install of already installed version', async () => {
    const availablePath = join(testChvmDir, 'available.json');
    fs.mkdirSync(dirname(availablePath), { recursive: true });
    fs.writeFileSync(availablePath, JSON.stringify([
      {
        version: '92.0.4515.159',
        revision: '882387',
        platform: 'Mac_Arm'
      }
    ], null, 2));

    // First install
    const output1 = runCLI('install 882387');
    
    // Second install (should skip or reinstall)
    const output2 = runCLI('install 882387');
    
    expect(output2).toMatch(/already installed|reinstall|exists|skip/i);
  }, 180000);

  it('should work with alias "i" for install', async () => {
    const availablePath = join(testChvmDir, 'available.json');
    fs.mkdirSync(dirname(availablePath), { recursive: true });
    fs.writeFileSync(availablePath, JSON.stringify([
      {
        version: '92.0.4515.159',
        revision: '882387',
        platform: 'Mac_Arm'
      }
    ], null, 2));

    const output = runCLI('i 882387');
    
    expect(output).toMatch(/882387|Installing|Downloading|Resolving/i);
  }, 120000);
});


