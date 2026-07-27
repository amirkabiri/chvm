/**
 * ls command - List available and installed Chromium versions
 */

import chalk from 'chalk';
import { Command } from 'commander';
import {
  getChvmHome,
  ensureChvmDir,
  readAvailableVersions,
  readInstalledVersions,
} from '../lib/storage.js';

export interface LsCommandOptions {
  json?: boolean;
}

export async function lsCommand(options: LsCommandOptions): Promise<void> {
  try {
    const chvmHome = getChvmHome();
    await ensureChvmDir(chvmHome);

    const available = await readAvailableVersions(chvmHome);
    const installed = await readInstalledVersions(chvmHome);

    if (options.json) {
      console.log(JSON.stringify({ available, installed }, null, 2));
    } else {
      if (available.length === 0) {
        console.log(
          chalk.yellow('No versions available. Run "chvm update" first.')
        );
        return;
      }

      console.log(chalk.bold('\nAvailable Chromium Versions:\n'));
      console.log(chalk.gray('VERSION\tREVISION\tCHANNEL\tSTATUS'));
      console.log(chalk.gray('─'.repeat(60)));

      for (const item of available) {
        const isInstalled = installed[item.version];
        const status = isInstalled ? chalk.green('* installed') : '';
        const revision =
          item.chromium_main_branch_position != null
            ? String(item.chromium_main_branch_position)
            : '-';
        console.log(
          `${item.version}\t${revision}\t${item.channel}\t${status}`
        );
      }
      console.log();
    }
  } catch (error) {
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

export function registerLsCommand(program: Command): void {
  program
    .command('ls')
    .description('List available and installed Chromium versions')
    .option('--json', 'Output in JSON format')
    .action(lsCommand);
}
