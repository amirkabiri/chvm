/**
 * open command - Open a specific Chromium version
 */

import chalk from 'chalk';
import { exec } from 'child_process';
import { existsSync } from 'fs';
import fs from 'fs/promises';
import { join } from 'path';
import { Command } from 'commander';
import {
  getChvmHome,
  ensureChvmDir,
  readAvailableVersions,
  readInstalledVersions,
} from '../lib/storage.js';
import { resolveVersion } from '../lib/mapping.js';
import { resolveWindowsAppPath } from '../lib/installer.js';
import { isMacOSArm, isWindows } from '../lib/platform-check.js';
import { installCommand } from './install.js';

export interface OpenCommandOptions {
  disableCors?: boolean;
}

export async function openCommand(
  version: string,
  options: OpenCommandOptions
): Promise<void> {
  try {
    const chvmHome = getChvmHome();
    await ensureChvmDir(chvmHome);

    let installed = await readInstalledVersions(chvmHome);
    const available = await readAvailableVersions(chvmHome);

    let versionToOpen: { version: string; path: string } | null = null;

    // Try to find in installed (check both version and revision)
    if (installed[version]) {
      versionToOpen = { version, ...installed[version] };
    } else {
      // Try to resolve and install
      const resolved = resolveVersion(version, available);
      if (!resolved) {
        throw new Error(
          `Version "${version}" not found. Run "chvm ls" to see available versions.`
        );
      }

      const revision = String(resolved.chromium_main_branch_position!);
      const installKey = resolved.version;

      if (!installed[installKey]) {
        console.log(
          chalk.blue(`${resolved.version} not installed. Installing...`)
        );
        await installCommand(revision, {});

        // Reload installed versions
        installed = await readInstalledVersions(chvmHome);
        versionToOpen = { version: installKey, ...installed[installKey] };
      } else {
        versionToOpen = { version: installKey, ...installed[installKey] };
      }
    }

    if (!versionToOpen || !versionToOpen.path) {
      throw new Error('Failed to prepare version for opening');
    }

    if (options.disableCors) {
      console.log(
        chalk.yellow(
          '⚠️  WARNING: Running with --disable-web-security. This is insecure and should only be used for development.'
        )
      );
    }

    // Prepare profile directory
    const profileDir = join(chvmHome, 'profiles', versionToOpen.version);
    await fs.mkdir(profileDir, { recursive: true });

    const args: string[] = [`--user-data-dir=${profileDir}`];
    if (options.disableCors) {
      args.push('--disable-web-security');
    }

    console.log(chalk.green(`Opening Chromium ${versionToOpen.version}...`));

    // macOS
    if (isMacOSArm()) {
      const execPath = join(
        versionToOpen.path,
        'Contents',
        'MacOS',
        'Chromium'
      );
      if (!existsSync(execPath)) {
        throw new Error(`Chromium executable not found at ${execPath}`);
      }

      const command = `open -a "${versionToOpen.path}" --args ${args.join(' ')}`;
      exec(command, error => {
        if (error) {
          console.error(chalk.red(`Failed to open: ${error.message}`));
          process.exit(1);
        }
      });
      return;
    }

    // Windows
    if (isWindows()) {
      const winAppDir = resolveWindowsAppPath(versionToOpen.path);
      const exePath = join(winAppDir, 'chrome.exe');

      if (!existsSync(exePath)) {
        throw new Error(`chrome.exe not found at ${exePath}`);
      }

      const command = `"${exePath}" ${args.join(' ')}`;
      exec(command, error => {
        if (error) {
          console.error(chalk.red(`Failed to open: ${error.message}`));
        }
      });

      return;
    }

    throw new Error('Unsupported platform');
  } catch (error) {
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

export function registerOpenCommand(program: Command): void {
  program
    .command('open <version>')
    .description('Open a specific Chromium version')
    .option('--disable-cors', 'Disable CORS (useful for development)')
    .action(openCommand);
}
