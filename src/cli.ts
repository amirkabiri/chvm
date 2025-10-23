#!/usr/bin/env node

/**
 * CHVM - Chrome Version Manager
 * Entry point for CLI
 */

import { Command } from 'commander';
import {
  registerLsCommand,
  registerUpdateCommand,
  registerInstallCommand,
  registerOpenCommand,
  registerUninstallCommand
} from './commands/index.js';

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

// Register all commands
registerLsCommand(program);
registerUpdateCommand(program);
registerInstallCommand(program);
registerOpenCommand(program);
registerUninstallCommand(program);

// Show help if no command provided
if (process.argv.length === 2) {
  program.outputHelp();
  process.exit(0);
}

program.parse();

