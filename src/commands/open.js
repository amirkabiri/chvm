/**
 * open command - Open a specific Chromium version
 */

import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { checkPlatform } from '../lib/platform-check.js';
import { getChvmHome, ensureChvmDir, readAvailableVersions, readInstalledVersions } from '../lib/storage.js';
import { resolveVersion } from '../lib/mapping.js';

const execAsync = promisify(exec);

export async function openCommand(version, options) {
  try {
    checkPlatform();
    const chvmHome = getChvmHome();
    await ensureChvmDir(chvmHome);

    const installed = await readInstalledVersions(chvmHome);
    const available = await readAvailableVersions(chvmHome);

    let versionToOpen = null;

    // Try to find in installed (check both version and revision)
    if (installed[version]) {
      versionToOpen = { version, ...installed[version] };
    } else {
      // Try to resolve and install
      const resolved = resolveVersion(version, available);
      if (!resolved) {
        throw new Error(`Version "${version}" not found. Run "chvm ls" to see available versions.`);
      }

      const installKey = resolved.version || resolved.revision;
      const displayVersion = resolved.version || `Revision ${resolved.revision}`;

      if (!installed[installKey]) {
        console.log(chalk.blue(`${displayVersion} not installed. Installing...`));
        // Use revision for install if no version
        await execAsync(`node ${process.argv[1]} install ${resolved.revision}`);

        // Reload installed versions
        const reloaded = await readInstalledVersions(chvmHome);
        versionToOpen = { version: installKey, ...reloaded[installKey] };
      } else {
        versionToOpen = { version: installKey, ...installed[installKey] };
      }
    }

    if (!versionToOpen) {
      throw new Error('Failed to prepare version for opening');
    }

    if (options.disableCors) {
      console.log(chalk.yellow('⚠️  WARNING: Running with --disable-web-security. This is insecure and should only be used for development.'));
    }

    // Prepare profile directory
    const profileDir = join(chvmHome, 'profiles', versionToOpen.version);
    await fs.mkdir(profileDir, { recursive: true });

    // Find executable
    const appPath = versionToOpen.path;
    const execPath = join(appPath, 'Contents', 'MacOS', 'Chromium');

    if (!existsSync(execPath)) {
      throw new Error(`Chromium executable not found at ${execPath}`);
    }

    const args = [
      `--user-data-dir=${profileDir}`
    ];

    if (options.disableCors) {
      args.push('--disable-web-security');
      args.push(`--user-data-dir=${join(chvmHome, 'tmp', versionToOpen.version)}`);
    }

    console.log(chalk.green(`Opening Chromium ${versionToOpen.version}...`));

    // Use open command on macOS
    const command = `open -a "${appPath}" --args ${args.join(' ')}`;

    exec(command, (error) => {
      if (error) {
        console.error(chalk.red(`Failed to open: ${error.message}`));
        process.exit(1);
      }
    });

  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

export function registerOpenCommand(program) {
  program
    .command('open <version>')
    .description('Open a specific Chromium version')
    .option('--disable-cors', 'Disable CORS (useful for development)')
    .action(openCommand);
}

