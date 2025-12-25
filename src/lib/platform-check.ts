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
    isSupported: isMacOSArm() || isWindows(),
  };
}

export function isMacOSArm(): boolean {
  return process.platform === 'darwin' && process.arch === 'arm64';
}

export function isWindows(): boolean {
  return process.platform === 'win32';
}

export function getChromiumPlatformPrefix(): string {
  if (process.platform === 'darwin' && process.arch === 'arm64') {
    return 'Mac_Arm';
  }

  if (process.platform === 'win32' && process.arch === 'x64') {
    return 'Win_x64';
  }

  throw new Error(`Unsupported platform: ${process.platform} ${process.arch}`);
}
