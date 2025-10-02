/**
 * Storage module - Manage JSON files and directory structure
 */

import { homedir } from 'os';
import { join } from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';

export function getChvmHome() {
  return process.env.CHVM_HOME || join(homedir(), '.chvm');
}

export async function ensureChvmDir(chvmHome) {
  const dirs = [
    chvmHome,
    join(chvmHome, 'installs'),
    join(chvmHome, 'profiles'),
    join(chvmHome, 'tmp'),
    join(chvmHome, 'logs')
  ];

  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }
}

export async function readAvailableVersions(chvmHome) {
  const availablePath = join(chvmHome, 'available.json');
  
  if (!existsSync(availablePath)) {
    return [];
  }

  const content = await fs.readFile(availablePath, 'utf8');
  return JSON.parse(content);
}

export async function writeAvailableVersions(chvmHome, data) {
  const availablePath = join(chvmHome, 'available.json');
  await fs.writeFile(availablePath, JSON.stringify(data, null, 2), 'utf8');
}

export async function readInstalledVersions(chvmHome) {
  const installedPath = join(chvmHome, 'installed.json');
  
  if (!existsSync(installedPath)) {
    return {};
  }

  const content = await fs.readFile(installedPath, 'utf8');
  return JSON.parse(content);
}

export async function writeInstalledVersions(chvmHome, data) {
  const installedPath = join(chvmHome, 'installed.json');
  await fs.writeFile(installedPath, JSON.stringify(data, null, 2), 'utf8');
}

export async function addInstalledVersion(chvmHome, versionInfo) {
  const installed = await readInstalledVersions(chvmHome);
  
  installed[versionInfo.version] = {
    revision: versionInfo.revision,
    path: versionInfo.path,
    installedAt: new Date().toISOString(),
    size: versionInfo.size
  };

  await writeInstalledVersions(chvmHome, installed);
}

export async function removeInstalledVersion(chvmHome, version) {
  const installed = await readInstalledVersions(chvmHome);
  
  delete installed[version];
  
  await writeInstalledVersions(chvmHome, installed);
}


