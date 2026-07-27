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

const AVAILABLE_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

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

    const availablePath = join(chvmHome, 'available.json');

    if (!options.force && fs.existsSync(availablePath)) {
      const ageMs = Date.now() - fs.statSync(availablePath).mtimeMs;
      if (ageMs < AVAILABLE_CACHE_TTL_MS) {
        const cached = JSON.parse(
          fs.readFileSync(availablePath, 'utf8')
        ) as Version[];
        console.log(
          chalk.green(
            `Using cached list (${cached.length} versions, updated ${Math.round(ageMs / 60000)}m ago). Use --force to refresh.`
          )
        );
        return;
      }
    }

    const spinner = ora('Fetching available Chromium versions...').start();

    try {
      const manifestUrl = new URL(
        `https://raw.githubusercontent.com/amirkabiri/chvm/refs/heads/main/public/manifest/${getManifestPlatform()}.json`
      );
      if (options.force) {
        manifestUrl.searchParams.set('t', String(Date.now()));
      }

      const response = await fetch(manifestUrl.toString(), {
        cache: options.force ? 'no-store' : 'default',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as Version[];
      fs.writeFileSync(availablePath, JSON.stringify(data, null, 2));
      spinner.succeed(
        chalk.green(`Updated! ${data.length} versions available.`)
      );
    } catch (error) {
      spinner.fail(chalk.red(`Failed to update: ${(error as Error).message}`));
      throw error;
    }
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
