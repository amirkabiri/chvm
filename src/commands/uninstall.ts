/**
 * uninstall command - Uninstall a specific Chromium version
 */

import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { Command } from 'commander';
import { checkPlatform } from '../lib/platform-check.js';
import {
  getChvmHome,
  ensureChvmDir,
  readAvailableVersions,
  readInstalledVersions,
  removeInstalledVersion,
} from '../lib/storage.js';
import { resolveVersion } from '../lib/mapping.js';
import { withLock } from '../lib/lock.js';

export interface UninstallCommandOptions {
  force?: boolean;
}

export async function uninstallCommand(
  version: string,
  options: UninstallCommandOptions
): Promise<void> {
  try {
    checkPlatform();
    const chvmHome = getChvmHome();
    await ensureChvmDir(chvmHome);

    await withLock(chvmHome, async () => {
      const installed = await readInstalledVersions(chvmHome);
      const available = await readAvailableVersions(chvmHome);

      // Try to resolve version
      let versionToUninstall = version;

      if (!installed[version]) {
        const resolved = resolveVersion(version, available);
        if (resolved && resolved.version && installed[resolved.version]) {
          versionToUninstall = resolved.version;
        } else {
          throw new Error(`Version "${version}" is not installed.`);
        }
      }

      const versionInfo = installed[versionToUninstall];
      const spinner = ora(`Uninstalling ${versionToUninstall}...`).start();

      // Remove app directory
      if (existsSync(versionInfo.path)) {
        await fs.rm(versionInfo.path, { recursive: true, force: true });
        spinner.text = 'Removed app bundle...';
      }

      // Remove profile directory
      const profileDir = join(chvmHome, 'profiles', versionToUninstall);
      if (existsSync(profileDir)) {
        await fs.rm(profileDir, { recursive: true, force: true });
        spinner.text = 'Removed profile...';
      }

      // Remove tmp directories
      const tmpDir = join(chvmHome, 'tmp', versionToUninstall);
      if (existsSync(tmpDir)) {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }

      // Remove from installed.json
      await removeInstalledVersion(chvmHome, versionToUninstall);

      spinner.succeed(chalk.green(`Uninstalled ${versionToUninstall}`));
    });
  } catch (error) {
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

export function registerUninstallCommand(program: Command): void {
  program
    .command('uninstall <version>')
    .description('Uninstall a specific Chromium version')
    .option('--force', 'Force uninstall even if running')
    .action(uninstallCommand);
}
