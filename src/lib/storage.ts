/**
 * Storage module - Manage JSON files and directory structure
 */

import { homedir } from 'os';
import { join } from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';

export interface AvailableVersion {
  version: string | null;
  revision: string;
  channel: string | null;
  platform: string;
  hasVersion: boolean;
}

export interface InstalledVersion {
  revision: string;
  path: string;
  installedAt: string;
  size: number;
}

export interface InstalledVersions {
  [version: string]: InstalledVersion;
}

export interface VersionInfo {
  version: string;
  revision: string;
  path: string;
  size: number;
}

export function getChvmHome(): string {
  return process.env.CHVM_HOME || join(homedir(), '.chvm');
}

export async function ensureChvmDir(chvmHome: string): Promise<void> {
  const dirs = [
    chvmHome,
    join(chvmHome, 'installs'),
    join(chvmHome, 'profiles'),
    join(chvmHome, 'tmp'),
    join(chvmHome, 'logs'),
  ];

  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }
}

export async function readAvailableVersions(
  chvmHome: string
): Promise<AvailableVersion[]> {
  const availablePath = join(chvmHome, 'available.json');

  if (!existsSync(availablePath)) {
    return [];
  }

  const content = await fs.readFile(availablePath, 'utf8');
  return JSON.parse(content);
}

export async function writeAvailableVersions(
  chvmHome: string,
  data: AvailableVersion[]
): Promise<void> {
  const availablePath = join(chvmHome, 'available.json');
  await fs.writeFile(availablePath, JSON.stringify(data, null, 2), 'utf8');
}

export async function readInstalledVersions(
  chvmHome: string
): Promise<InstalledVersions> {
  const installedPath = join(chvmHome, 'installed.json');

  if (!existsSync(installedPath)) {
    return {};
  }

  const content = await fs.readFile(installedPath, 'utf8');
  return JSON.parse(content);
}

export async function writeInstalledVersions(
  chvmHome: string,
  data: InstalledVersions
): Promise<void> {
  const installedPath = join(chvmHome, 'installed.json');
  await fs.writeFile(installedPath, JSON.stringify(data, null, 2), 'utf8');
}

export async function addInstalledVersion(
  chvmHome: string,
  versionInfo: VersionInfo
): Promise<void> {
  const installed = await readInstalledVersions(chvmHome);

  installed[versionInfo.version] = {
    revision: versionInfo.revision,
    path: versionInfo.path,
    installedAt: new Date().toISOString(),
    size: versionInfo.size,
  };

  await writeInstalledVersions(chvmHome, installed);
}

export async function removeInstalledVersion(
  chvmHome: string,
  version: string
): Promise<void> {
  const installed = await readInstalledVersions(chvmHome);

  delete installed[version];

  await writeInstalledVersions(chvmHome, installed);
}
