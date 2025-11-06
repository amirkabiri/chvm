import { describe, it, expect } from '@jest/globals';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI_PATH = join(__dirname, '../../src/cli.cjs');

function runCLI(args = '', env: Record<string, string> = {}) {
  const command = `node ${CLI_PATH} ${args}`;
  try {
    return execSync(command, {
      encoding: 'utf8',
      stdio: 'pipe',
      env: { ...process.env, ...env },
    });
  } catch (error: any) {
    return {
      stdout: error.stdout?.toString() || '',
      stderr: error.stderr?.toString() || '',
      status: error.status,
      error: true,
    };
  }
}

describe('E2E: Platform Check', () => {
  const isReallyMacOSArm =
    process.platform === 'darwin' && process.arch === 'arm64';

  if (!isReallyMacOSArm) {
    it('should reject on non-macOS ARM platform', () => {
      const result = runCLI('ls');
      expect((result as any).error).toBe(true);
      expect((result as any).stderr || (result as any).stdout).toMatch(
        /macOS.*ARM|Apple Silicon/i
      );
    });
  } else {
    it('should work on macOS ARM platform', () => {
      // On correct platform, it should not throw platform errors
      const result = runCLI('--help');
      expect(result).toContain('chvm');
    });
  }

  // Mock test - simulate wrong platform
  it('should detect platform requirements in code', async () => {
    // We'll test the platform check module directly
    const { checkPlatform } = await import('../../src/lib/platform-check.js');

    // This should either succeed (on macOS ARM) or throw
    const currentPlatform = { platform: process.platform, arch: process.arch };

    if (
      currentPlatform.platform === 'darwin' &&
      currentPlatform.arch === 'arm64'
    ) {
      expect(() => checkPlatform()).not.toThrow();
    } else {
      expect(() => checkPlatform()).toThrow(/macOS.*ARM|Apple Silicon/i);
    }
  });
});
