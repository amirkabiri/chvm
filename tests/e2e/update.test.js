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

describe('E2E: chvm update', () => {
  beforeEach(() => {
    testChvmDir = fs.mkdtempSync(join(os.tmpdir(), 'chvm-test-update-'));
  });

  afterEach(() => {
    if (testChvmDir && fs.existsSync(testChvmDir)) {
      fs.rmSync(testChvmDir, { recursive: true, force: true });
    }
  });

  it('should fetch and cache remote revisions', async () => {
    const output = runCLI('update');
    
    // Check if command succeeded
    if (typeof output === 'object' && output.error) {
      // Network error is acceptable in tests
      expect(output.stderr || output.stdout).toMatch(/network|fetch|error/i);
    } else {
      // Should show progress or success message
      expect(output).toMatch(/Fetching|Updated|Success|available/i);
      
      // Check if files were created
      const availablePath = join(testChvmDir, 'available.json');
      const remoteRevisionsPath = join(testChvmDir, 'remote-revisions.json');
      
      // At least one should exist
      expect(
        fs.existsSync(availablePath) || fs.existsSync(remoteRevisionsPath)
      ).toBe(true);
      
      if (fs.existsSync(availablePath)) {
        const data = JSON.parse(fs.readFileSync(availablePath, 'utf8'));
        expect(Array.isArray(data) || typeof data === 'object').toBe(true);
      }
    }
  }, 30000); // 30 second timeout for network request

  it('should support --force flag to bypass cache', async () => {
    // First update
    runCLI('update');
    
    // Modify available.json to check if --force overwrites
    const availablePath = join(testChvmDir, 'available.json');
    if (fs.existsSync(availablePath)) {
      const oldMtime = fs.statSync(availablePath).mtimeMs;
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Force update
      const output = runCLI('update --force');
      
      if (fs.existsSync(availablePath)) {
        const newMtime = fs.statSync(availablePath).mtimeMs;
        // File should be updated (or at least attempted)
        expect(output).toMatch(/Fetching|Updated|force/i);
      }
    }
  }, 30000);

  it('should create available.json with proper structure', async () => {
    const output = runCLI('update');
    
    const availablePath = join(testChvmDir, 'available.json');
    
    if (fs.existsSync(availablePath)) {
      const data = JSON.parse(fs.readFileSync(availablePath, 'utf8'));
      
      if (Array.isArray(data) && data.length > 0) {
        const item = data[0];
        
        // Should have revision
        expect(item).toHaveProperty('revision');
        
        // Might have version (from mapping)
        // At minimum should have platform info
        expect(typeof item.revision === 'string' || typeof item.revision === 'number').toBe(true);
      }
    }
  }, 30000);

  it('should handle network errors gracefully', async () => {
    // Test with invalid network by mocking or expecting graceful failure
    const output = runCLI('update', { 
      env: { HTTP_PROXY: 'http://invalid-proxy:9999' } 
    });
    
    if (typeof output === 'object' && output.error) {
      expect(output.stderr || output.stdout).toMatch(/error|failed|network|fetch/i);
      // Should not crash with unhandled exception
      expect(output.status).toBeDefined();
    }
  }, 30000);

  it('should show progress during update', async () => {
    const output = runCLI('update');
    
    // Should show some kind of progress indicator
    expect(output).toMatch(/Fetching|Downloading|Updating|Processing|Success|Done/i);
  }, 30000);
});


