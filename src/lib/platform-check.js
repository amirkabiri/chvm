/**
 * Platform check module - Verify macOS ARM - Stub for TDD
 */

export function checkPlatform() {
  const info = getPlatformInfo();
  
  if (!info.isSupported) {
    throw new Error(
      `chvm only supports macOS with ARM architecture (Apple Silicon).\n` +
      `Current platform: ${info.platform} ${info.arch}`
    );
  }
}

export function getPlatformInfo() {
  return {
    platform: process.platform,
    arch: process.arch,
    isSupported: isMacOSArm()
  };
}

export function isMacOSArm() {
  return process.platform === 'darwin' && process.arch === 'arm64';
}


