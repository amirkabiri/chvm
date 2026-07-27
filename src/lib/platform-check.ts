/**
 * Platform check module - Supported OS/arch detection for Chromium snapshots
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
    isSupported: isSupportedPlatform(),
  };
}

export function isSupportedPlatform(): boolean {
  return isMacOS() || isWindows() || isLinux();
}

export function isMacOSArm(): boolean {
  return process.platform === 'darwin' && process.arch === 'arm64';
}

export function isMacOSIntel(): boolean {
  return process.platform === 'darwin' && process.arch === 'x64';
}

export function isMacOS(): boolean {
  return isMacOSArm() || isMacOSIntel();
}

export function isWindows(): boolean {
  return (
    process.platform === 'win32' &&
    (process.arch === 'x64' || process.arch === 'arm64')
  );
}

export function isLinux(): boolean {
  return (
    process.platform === 'linux' &&
    (process.arch === 'x64' || process.arch === 'arm64' || process.arch === 'arm')
  );
}

export function getChromiumPlatformPrefix(): string {
  if (isMacOSArm()) {
    return 'Mac_Arm';
  }

  if (isMacOSIntel()) {
    return 'Mac';
  }

  if (process.platform === 'win32' && process.arch === 'x64') {
    return 'Win_x64';
  }

  if (process.platform === 'win32' && process.arch === 'arm64') {
    return 'Win_Arm64';
  }

  if (process.platform === 'linux' && process.arch === 'x64') {
    return 'Linux_x64';
  }

  if (
    process.platform === 'linux' &&
    (process.arch === 'arm64' || process.arch === 'arm')
  ) {
    return 'Linux_Arm';
  }

  throw new Error(`Unsupported platform: ${process.platform} ${process.arch}`);
}

export function getChromiumZipName(): string {
  if (isMacOS()) {
    return 'chrome-mac.zip';
  }

  if (isWindows()) {
    return 'chrome-win.zip';
  }

  if (isLinux()) {
    return 'chrome-linux.zip';
  }

  throw new Error(`Unsupported platform: ${process.platform} ${process.arch}`);
}
