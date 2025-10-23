/**
 * ls command - List available and installed Chromium versions
 */

import chalk from 'chalk';
import { checkPlatform } from '../lib/platform-check.js';
import { getChvmHome, ensureChvmDir, readAvailableVersions, readInstalledVersions } from '../lib/storage.js';

export async function lsCommand(options) {
  try {
    checkPlatform();
    const chvmHome = getChvmHome();
    await ensureChvmDir(chvmHome);

    const available = await readAvailableVersions(chvmHome);
    const installed = await readInstalledVersions(chvmHome);

    if (options.json) {
      console.log(JSON.stringify({ available, installed }, null, 2));
    } else {
      if (available.length === 0) {
        console.log(chalk.yellow('No versions available. Run "chvm update" first.'));
        return;
      }

      console.log(chalk.bold('\nAvailable Chromium Versions:\n'));
      console.log(chalk.gray('VERSION\tREVISION\tCHANNEL\tSTATUS'));
      console.log(chalk.gray('─'.repeat(60)));

      const printedMajors = new Set();
      for (const item of available) {
        if (!item.version) {
          continue;
        }
        const major = item.version.split('.')[0];
        if (printedMajors.has(major)) {
          continue;
        }
        printedMajors.add(major);

        const displayVersion = item.version || chalk.gray(`[${item.revision}]`);
        // Check both version and revision for installed status
        const installKey = item.version || item.revision;
        const isInstalled = installed[installKey];
        const status = isInstalled ? chalk.green('* installed') : '';
        console.log(`${displayVersion}\t${item.revision}\t${item.channel}\t${status}`);
      }
      console.log();
    }
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

export function registerLsCommand(program) {
  program
    .command('ls')
    .description('List available and installed Chromium versions')
    .option('--json', 'Output in JSON format')
    .action(lsCommand);
}

