/**
 * Test utilities and helpers for CHVM tests
 */

import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const CLI_PATH = join(__dirname, '../../src/cli.js');

/**
 * Create a temporary test directory
 */
export function createTestDir(prefix = 'chvm-test-') {
  return fs.mkdtempSync(join(os.tmpdir(), prefix));
}

/**
 * Cleanup test directory
 */
export function cleanupTestDir(dir) {
  if (dir && fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Run CLI command and return output
 */
export function runCLI(args = '', options = {}) {
  const command = `node ${CLI_PATH} ${args}`;
  const env = { ...process.env, ...options.env };
  
  try {
    return execSync(command, {
      encoding: 'utf8',
      stdio: 'pipe',
      env,
      timeout: options.timeout || 10000,
      maxBuffer: options.maxBuffer || 10 * 1024 * 1024,
      ...options
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

/**
 * Create mock available.json
 */
export function createMockAvailable(chvmHome, versions) {
  const availablePath = join(chvmHome, 'available.json');
  fs.mkdirSync(dirname(availablePath), { recursive: true });
  fs.writeFileSync(availablePath, JSON.stringify(versions, null, 2));
  return availablePath;
}

/**
 * Create mock installed.json
 */
export function createMockInstalled(chvmHome, versions) {
  const installedPath = join(chvmHome, 'installed.json');
  fs.mkdirSync(dirname(installedPath), { recursive: true });
  fs.writeFileSync(installedPath, JSON.stringify(versions, null, 2));
  return installedPath;
}

/**
 * Create mock app bundle structure
 */
export function createMockAppBundle(appPath, options = {}) {
  const contentsDir = join(appPath, 'Contents');
  const macosDir = join(contentsDir, 'MacOS');
  
  fs.mkdirSync(macosDir, { recursive: true });
  
  const execName = options.execName || 'Chromium';
  const execPath = join(macosDir, execName);
  
  fs.writeFileSync(execPath, options.content || '#!/bin/bash\necho "Mock Chromium"\n');
  fs.chmodSync(execPath, 0o755);
  
  // Create Info.plist
  const infoPlistPath = join(contentsDir, 'Info.plist');
  fs.writeFileSync(infoPlistPath, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>${execName}</string>
    <key>CFBundleIdentifier</key>
    <string>org.chromium.Chromium</string>
</dict>
</plist>`);
  
  return appPath;
}

/**
 * Wait for condition to be true
 */
export async function waitFor(condition, options = {}) {
  const timeout = options.timeout || 5000;
  const interval = options.interval || 100;
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error('Timeout waiting for condition');
}

/**
 * Check if running on macOS ARM
 */
export function isMacOSArm() {
  return process.platform === 'darwin' && process.arch === 'arm64';
}

/**
 * Skip test if not on macOS ARM
 */
export function skipIfNotMacOSArm() {
  if (!isMacOSArm()) {
    return true;
  }
  return false;
}

/**
 * Mock version data
 */
export const MOCK_VERSIONS = {
  v92: {
    version: '92.0.4515.159',
    revision: '882387',
    platform: 'Mac_Arm'
  },
  v93: {
    version: '93.0.4577.82',
    revision: '911515',
    platform: 'Mac_Arm'
  },
  v91: {
    version: '91.0.4472.124',
    revision: '870763',
    platform: 'Mac_Arm'
  }
};

/**
 * Create full mock environment
 */
export function createMockEnvironment(chvmHome) {
  // Create directory structure
  fs.mkdirSync(join(chvmHome, 'installs'), { recursive: true });
  fs.mkdirSync(join(chvmHome, 'profiles'), { recursive: true });
  fs.mkdirSync(join(chvmHome, 'tmp'), { recursive: true });
  fs.mkdirSync(join(chvmHome, 'logs'), { recursive: true });
  
  // Create available.json
  createMockAvailable(chvmHome, [
    MOCK_VERSIONS.v92,
    MOCK_VERSIONS.v93,
    MOCK_VERSIONS.v91
  ]);
  
  // Create empty installed.json
  createMockInstalled(chvmHome, {});
  
  return chvmHome;
}

/**
 * Assert that output contains expected patterns
 */
export function assertOutputContains(output, patterns) {
  const text = typeof output === 'string' ? output : (output.stdout || output.stderr || '');
  
  for (const pattern of Array.isArray(patterns) ? patterns : [patterns]) {
    if (pattern instanceof RegExp) {
      if (!pattern.test(text)) {
        throw new Error(`Output does not match pattern: ${pattern}`);
      }
    } else {
      if (!text.includes(pattern)) {
        throw new Error(`Output does not contain: ${pattern}`);
      }
    }
  }
}

/**
 * Assert that a file exists
 */
export function assertFileExists(filePath, message) {
  if (!fs.existsSync(filePath)) {
    throw new Error(message || `File does not exist: ${filePath}`);
  }
}

/**
 * Assert that a file does not exist
 */
export function assertFileNotExists(filePath, message) {
  if (fs.existsSync(filePath)) {
    throw new Error(message || `File should not exist: ${filePath}`);
  }
}

/**
 * Get file size in bytes
 */
export function getFileSize(filePath) {
  const stats = fs.statSync(filePath);
  return stats.size;
}

/**
 * Calculate directory size recursively
 */
export function calculateDirSize(dirPath) {
  let totalSize = 0;
  
  function traverse(currentPath) {
    const stats = fs.statSync(currentPath);
    
    if (stats.isFile()) {
      totalSize += stats.size;
    } else if (stats.isDirectory()) {
      const files = fs.readdirSync(currentPath);
      files.forEach(file => {
        traverse(join(currentPath, file));
      });
    }
  }
  
  traverse(dirPath);
  return totalSize;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


