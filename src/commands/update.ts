/**
 * update command - Update the list of available Chromium versions
 */

import chalk from 'chalk';
import ora from 'ora';
import { Command } from 'commander';
import { checkPlatform } from '../lib/platform-check.js';
import {
  getChvmHome,
  ensureChvmDir,
  writeAvailableVersions,
} from '../lib/storage.js';
import { createLogger } from '../lib/logger.js';
import { buildAvailableVersions } from '../lib/mapping.js';

export interface UpdateCommandOptions {
  force?: boolean;
}

export async function updateCommand(
  options: UpdateCommandOptions
): Promise<void> {
  try {
    checkPlatform();
    const chvmHome = getChvmHome();
    await ensureChvmDir(chvmHome);

    const logger = createLogger({ chvmHome, level: 'info' });
    const spinner = ora('Fetching available Chromium versions...').start();

    try {
      const available = await buildAvailableVersions();

      if (available.length === 0) {
        spinner.warn(
          chalk.yellow(
            'No versions found with matching revisions. Try again later.'
          )
        );
      } else {
        await writeAvailableVersions(chvmHome, available);
        spinner.succeed(
          chalk.green(`Updated! ${available.length} versions available.`)
        );
      }
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
