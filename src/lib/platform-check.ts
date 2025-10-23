/**
 * Platform check module - Verify macOS ARM - Stub for TDD
 */

export interface PlatformInfo {
  platform: string;
  arch: string;
  isSupported: boolean;
}

export function checkPlatform(): void {
  const info = getPlatformInfo();

  if (!info.isSupported) {
    throw new Error(
      `chvm only supports macOS with ARM architecture (Apple Silicon).\n` +
        `Current platform: ${info.platform} ${info.arch}`
    );
  }
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
