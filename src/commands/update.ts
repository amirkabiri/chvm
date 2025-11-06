/**
 * update command - Update the list of available Chromium versions
 */

import chalk from 'chalk';
import ora from 'ora';
import { Command } from 'commander';
import { getChvmHome, ensureChvmDir } from '../lib/storage.js';
import fs from 'fs';
import { join } from 'path';
import { Version } from '../manifest/shared/types';

type ManifestPlatform =
  | 'android'
  | 'android_arm64'
  | 'linux'
  | 'linux_arm'
  | 'linux_x64'
  | 'mac'
  | 'mac_arm'
  | 'win'
  | 'win32'
  | 'win32_x64'
  | 'win_arm64'
  | 'win_x64';

function getManifestPlatform(): ManifestPlatform {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === 'linux') {
    if (arch === 'x64') return 'linux_x64';
    if (arch === 'arm' || arch === 'arm64') return 'linux_arm';
    return 'linux';
  }

  if (platform === 'darwin') {
    if (arch === 'arm64') return 'mac_arm';
    return 'mac';
  }

  if (platform === 'win32') {
    if (arch === 'x64') return 'win_x64';
    if (arch === 'arm64') return 'win_arm64';
    if (arch === 'ia32') return 'win32';
    return 'win';
  }

  throw new Error(`Your platform is not supported yet: ${platform} ${arch}`);
}

export interface UpdateCommandOptions {
  force?: boolean;
}

export async function updateCommand(
  options: UpdateCommandOptions
): Promise<void> {
  try {
    const chvmHome = getChvmHome();
    await ensureChvmDir(chvmHome);

    const spinner = ora('Fetching available Chromium versions...').start();

    fetch(
      `https://raw.githubusercontent.com/amirkabiri/chvm/refs/heads/main/public/manifest/${getManifestPlatform()}.json`
    )
      .then(res => res.json())
      .then(data => {
        const availablePath = join(chvmHome, 'available.json');
        fs.writeFileSync(availablePath, JSON.stringify(data, null, 2));
        spinner.succeed(
          chalk.green(
            `Updated! ${(data as Version[]).length} versions available.`
          )
        );
      })
      .catch(error => {
        spinner.fail(
          chalk.red(`Failed to update: ${(error as Error).message}`)
        );
        throw error;
      });
  } catch (error) {
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

export function registerUpdateCommand(program: Command): void {
  program
    .command('update')
    .description('Update the list of available Chromium versions')
    .option('--force', 'Force update, bypass cache')
    .action(updateCommand);
}
