#!/usr/bin/env node

/**
 * CHVM - Chrome Version Manager
 * Entry point for CLI
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { checkPlatform } from './lib/platform-check.js';
import { getChvmHome, ensureChvmDir, readAvailableVersions, writeAvailableVersions, readInstalledVersions, addInstalledVersion, removeInstalledVersion } from './lib/storage.js';
import { createLogger } from './lib/logger.js';
import { fetchRevisions, fetchVersionMapping, mergeRevisionsWithVersions, resolveVersion, buildAvailableVersions } from './lib/mapping.js';
import { getDownloadUrl, fetchRevisionMetadata, downloadWithProgress } from './lib/downloader.js';
import { atomicInstall, extractZip, verifyAppBundle, calculateDirectorySize } from './lib/installer.js';
import { withLock } from './lib/lock.js';
import ora from 'ora';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

const program = new Command();

program
  .name('chvm')
  .description('Chrome Version Manager - Manage multiple Chromium versions on macOS ARM')
  .version('1.0.0');

// Help command (default)
program
  .command('help', { isDefault: false })
  .description('Show help information')
  .action(() => {
    program.outputHelp();
  });

// ls command
program
  .command('ls')
  .description('List available and installed Chromium versions')
  .option('--json', 'Output in JSON format')
  .action(async (options) => {
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
            if(!item.version){
                continue
            }
            const major = item.version.split('.')[0];
            if(printedMajors.has(major)){
                continue
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
  });

// update command
program
  .command('update')
  .description('Update the list of available Chromium versions')
  .option('--force', 'Force update, bypass cache')
  .action(async (options) => {
    try {
      checkPlatform();
      const chvmHome = getChvmHome();
      await ensureChvmDir(chvmHome);

      const logger = createLogger({ chvmHome, level: 'info' });
      const spinner = ora('Fetching available Chromium versions...').start();

      try {
        const available = await buildAvailableVersions();

        if (available.length === 0) {
          spinner.warn(chalk.yellow('No versions found with matching revisions. Try again later.'));
        } else {
          await writeAvailableVersions(chvmHome, available);
          spinner.succeed(chalk.green(`Updated! ${available.length} versions available.`));
        }
      } catch (error) {
        spinner.fail(chalk.red(`Failed to update: ${error.message}`));
        throw error;
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

// install command
program
  .command('install <version>')
  .alias('i')
  .description('Install a specific Chromium version')
  .option('--no-cache', 'Skip cache and download fresh')
  .option('--quiet', 'Minimal output')
  .action(async (version, options) => {
    try {
      checkPlatform();
      const chvmHome = getChvmHome();
      await ensureChvmDir(chvmHome);

      const logger = createLogger({ chvmHome, level: options.quiet ? 'error' : 'info' });

      await withLock(chvmHome, async () => {
        const available = await readAvailableVersions(chvmHome);

        if (available.length === 0) {
          throw new Error('No versions available. Please run "chvm update" first.');
        }

        const resolved = resolveVersion(version, available);

        if (!resolved) {
          throw new Error(`Version "${version}" not found. Run "chvm ls" to see available versions.`);
        }

        const displayVersion = resolved.version || `Revision ${resolved.revision}`;
        console.log(chalk.blue(`Resolving '${version}' -> ${displayVersion} (revision: ${resolved.revision})`));

        // Check if already installed
        const installed = await readInstalledVersions(chvmHome);
        const installKey = resolved.version || resolved.revision;
        if (installed[installKey]) {
          console.log(chalk.yellow(`Version ${displayVersion} is already installed.`));
          return;
        }

        const spinner = ora('Fetching revision metadata...').start();

        const metadata = await fetchRevisionMetadata(resolved.revision);
        const chromeMacZip = metadata.items.find(item => item.name.includes('chrome-mac.zip'));


        if (!chromeMacZip) {
          throw new Error('chrome-mac.zip not found in revision');
        }

        spinner.text = `Downloading Chromium ${displayVersion}...`;

        const tmpZip = join(chvmHome, 'tmp', `chrome-${resolved.revision}.zip`);
        await fs.mkdir(join(chvmHome, 'tmp'), { recursive: true });

        await downloadWithProgress(chromeMacZip.mediaLink, tmpZip, (progress) => {
          spinner.text = `Downloading: ${progress.percentage}% (${Math.round(progress.downloaded / 1024 / 1024)}MB / ${Math.round(progress.total / 1024 / 1024)}MB)`;
        });

        spinner.text = 'Extracting...';

        const finalPath = join(chvmHome, 'installs', `${installKey}.app`);

        await atomicInstall(async (tmpDir) => {
          const extractPath = join(tmpDir, 'extracted');

          spinner.text = 'Extracting zip...';
          await extractZip(tmpZip, extractPath, (progress) => {
            spinner.text = `Extracting: ${progress.extractedFiles} files...`;
          });

          spinner.text = 'Looking for app bundle...';

          // Find the .app bundle
          const files = await fs.readdir(extractPath);
          console.log('Extracted files:', files.slice(0, 10).join(', ')); // Debug

          const appBundle = files.find(f => f.endsWith('.app'));

          if (!appBundle) {
            // Maybe it's in a subdirectory like chrome-mac/
            const chromeMacDir = join(extractPath, 'chrome-mac');
            if (existsSync(chromeMacDir)) {
              const subFiles = await fs.readdir(chromeMacDir);
              const subAppBundle = subFiles.find(f => f.endsWith('.app'));
              if (subAppBundle) {
                return join(chromeMacDir, subAppBundle);
              }
            }
            throw new Error('App bundle not found in extracted files');
          }

          return join(extractPath, appBundle);
        }, finalPath, chvmHome);

        // Cleanup tmp zip
        await fs.unlink(tmpZip).catch(() => {});

        spinner.text = 'Verifying installation...';
        const isValid = await verifyAppBundle(finalPath);

        if (!isValid) {
          throw new Error('Installation verification failed: Invalid app bundle structure');
        }

        const size = await calculateDirectorySize(finalPath);

        await addInstalledVersion(chvmHome, {
          version: installKey,
          revision: resolved.revision,
          path: finalPath,
          size
        });

        spinner.succeed(chalk.green(`Installed ${displayVersion} to ${finalPath}`));
        logger.info(`Installed version ${displayVersion}`);

      }, { timeout: 600000 }); // 10 minute timeout

    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
process.exit(1);
    }
  });

// open command
program
  .command('open <version>')
  .description('Open a specific Chromium version')
  .option('--disable-cors', 'Disable CORS (useful for development)')
  .action(async (version, options) => {
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
  });

// uninstall command
program
  .command('uninstall <version>')
  .description('Uninstall a specific Chromium version')
  .option('--force', 'Force uninstall even if running')
  .action(async (version, options) => {
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
          if (resolved && installed[resolved.version]) {
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
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

// Show help if no command provided
if (process.argv.length === 2) {
  program.outputHelp();
  process.exit(0);
}

program.parse();


