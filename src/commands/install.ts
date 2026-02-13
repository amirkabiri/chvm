/**
 * install command - Install a specific Chromium version
 */

import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { Command } from 'commander';
import {
  getChvmHome,
  ensureChvmDir,
  readAvailableVersions,
  readInstalledVersions,
  addInstalledVersion,
} from '../lib/storage.js';
import { createLogger } from '../lib/logger.js';
import { resolveVersion } from '../lib/mapping.js';
import {
  fetchRevisionMetadata,
  downloadWithProgress,
} from '../lib/downloader.js';
import {
  atomicInstall,
  extractZip,
  verifyAppBundle,
  calculateDirectorySize,
} from '../lib/installer.js';
import { withLock } from '../lib/lock.js';
import { isMacOSArm, isWindows } from '../lib/platform-check.js';

export interface InstallCommandOptions {
  cache?: boolean;
  quiet?: boolean;
}

export async function installCommand(
  version: string,
  options: InstallCommandOptions
): Promise<void> {
  try {
    const chvmHome = getChvmHome();
    await ensureChvmDir(chvmHome);

    const logger = createLogger({
      chvmHome,
      level: options.quiet ? 'error' : 'info',
    });

    await withLock(
      chvmHome,
      async () => {
        const available = await readAvailableVersions(chvmHome);

        if (available.length === 0) {
          throw new Error(
            'No versions available. Please run "chvm update" first.'
          );
        }

        const resolved = resolveVersion(version, available);

        if (!resolved) {
          throw new Error(
            `Version "${version}" not found. Run "chvm ls" to see available versions.`
          );
        }

        const revision = String(resolved.chromium_main_branch_position!);
        const displayVersion = resolved.version || `Revision ${revision}`;
        console.log(
          chalk.blue(
            `Resolving '${version}' -> ${displayVersion} (revision: ${revision})`
          )
        );

        // Check if already installed
        const installed = await readInstalledVersions(chvmHome);
        const installKey = resolved.version || revision;
        if (installed[installKey]) {
          console.log(
            chalk.yellow(`Version ${displayVersion} is already installed.`)
          );
          return;
        }

        const spinner = ora('Fetching revision metadata...').start();

        const metadata = await fetchRevisionMetadata(revision);

        // Determine expected zip name based on platform
        let expectedZipName = '';
        if (isWindows()) {
          // chrome-win.zip for Win_x64
          expectedZipName = 'chrome-win.zip';
        } else if (isMacOSArm()) {
          expectedZipName = 'chrome-mac.zip';
        } else {
          throw new Error(`Unsupported platform`);
        }

        const chromeZip = metadata.items.find(item =>
          item.name.includes(expectedZipName)
        );

        if (!chromeZip) {
          throw new Error(`${expectedZipName} not found in revision`);
        }

        spinner.text = `Downloading Chromium ${displayVersion}...`;

        const tmpZip = join(chvmHome, 'tmp', `chrome-${revision}.zip`);
        await fs.mkdir(join(chvmHome, 'tmp'), { recursive: true });

        await downloadWithProgress(chromeZip.mediaLink, tmpZip, progress => {
          spinner.text = `Downloading: ${progress.percentage}% (${Math.round(progress.downloaded / 1024 / 1024)}MB / ${Math.round(progress.total / 1024 / 1024)}MB)`;
        });

        spinner.text = 'Extracting...';

        const finalPath = join(
          chvmHome,
          'installs',
          isWindows() ? installKey : `${installKey}.app`
        );

        await atomicInstall(
          async tmpDir => {
            const extractPath = join(tmpDir, 'extracted');

            spinner.text = 'Extracting zip...';
            await extractZip(tmpZip, extractPath, progress => {
              spinner.text = `Extracting: ${progress.extractedFiles} files...`;
            });

            spinner.text = 'Looking for executable/bundle...';

            // Find the executable or app bundle
            const files = await fs.readdir(extractPath);
            console.log('Extracted files:', files.slice(0, 10).join(', ')); // Debug

            // Windows
            if (isWindows()) {
              const chromeWinDir = files.find(
                f => f === 'chrome-win' || f.includes('chrome-win')
              );
              if (chromeWinDir) {
                return join(extractPath, chromeWinDir);
              }
              // Fallback: check if chrome.exe is in root
              if (files.includes('chrome.exe')) {
                return extractPath;
              }
              throw new Error('chrome.exe or chrome-win folder not found');
            } else if (isMacOSArm()) {
              // Mac
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
            }

            throw new Error(`Unsupported platform`);
          },
          finalPath,
          chvmHome
        );

        // Cleanup tmp zip
        await fs.unlink(tmpZip).catch(() => {});

        spinner.text = 'Verifying installation...';
        const isValid = await verifyAppBundle(finalPath);

        if (!isValid) {
          throw new Error(
            'Installation verification failed: Invalid app bundle structure'
          );
        }

        const size = await calculateDirectorySize(finalPath);

        await addInstalledVersion(chvmHome, {
          version: installKey,
          revision: revision,
          path: finalPath,
          size,
        });

        spinner.succeed(
          chalk.green(`Installed ${displayVersion} to ${finalPath}`)
        );
        logger.info(`Installed version ${displayVersion}`);
      },
      { timeout: 600000 }
    ); // 10 minute timeout
  } catch (error) {
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

export function registerInstallCommand(program: Command): void {
  program
    .command('install <version>')
    .alias('i')
    .description('Install a specific Chromium version')
    .option('--no-cache', 'Skip cache and download fresh')
    .option('--quiet', 'Minimal output')
    .action(installCommand);
}
