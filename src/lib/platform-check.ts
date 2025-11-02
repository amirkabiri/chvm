/**
 * Platform check module - Verify macOS ARM - Stub for TDD
 */

export interface PlatformInfo {
  platform: string;
  arch: string;
  isSupported: boolean;
}

export function getPlatformInfo(): PlatformInfo {
  return {
    platform: process.platform,
    arch: process.arch,
    isSupported: isMacOSArm(),
  };
}

export function isMacOSArm(): boolean {
  return process.platform === 'darwin' && process.arch === 'arm64';
}
