/**
 * Process helpers - detect and stop Chromium processes for an install path
 */

import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface RunningProcess {
  pid: number;
  command: string;
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').toLowerCase();
}

export async function findProcessesUsingPath(
  appPath: string
): Promise<RunningProcess[]> {
  const needle = normalizePath(appPath);
  if (!needle) return [];

  if (process.platform === 'win32') {
    return findWindowsProcesses(needle);
  }

  return findUnixProcesses(needle);
}

async function findUnixProcesses(needle: string): Promise<RunningProcess[]> {
  try {
    const { stdout } = await execFileAsync('ps', ['-ax', '-o', 'pid=,command=']);
    const matches: RunningProcess[] = [];

    for (const line of stdout.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const match = trimmed.match(/^(\d+)\s+(.+)$/);
      if (!match) continue;

      const pid = Number(match[1]);
      const command = match[2];
      if (normalizePath(command).includes(needle)) {
        matches.push({ pid, command });
      }
    }

    return matches;
  } catch {
    return [];
  }
}

async function findWindowsProcesses(needle: string): Promise<RunningProcess[]> {
  try {
    const { stdout } = await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-Command',
      "Get-CimInstance Win32_Process | Select-Object ProcessId,ExecutablePath,CommandLine | ConvertTo-Json -Compress",
    ]);

    if (!stdout.trim()) return [];

    const parsed = JSON.parse(stdout) as
      | Array<{
          ProcessId?: number;
          ExecutablePath?: string | null;
          CommandLine?: string | null;
        }>
      | {
          ProcessId?: number;
          ExecutablePath?: string | null;
          CommandLine?: string | null;
        };

    const rows = Array.isArray(parsed) ? parsed : [parsed];
    const matches: RunningProcess[] = [];

    for (const row of rows) {
      const haystack = normalizePath(
        `${row.ExecutablePath || ''} ${row.CommandLine || ''}`
      );
      if (haystack.includes(needle) && row.ProcessId) {
        matches.push({
          pid: row.ProcessId,
          command: row.CommandLine || row.ExecutablePath || String(row.ProcessId),
        });
      }
    }

    return matches;
  } catch {
    return [];
  }
}

export async function killProcesses(pids: number[]): Promise<void> {
  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // Process may have already exited
    }
  }

  // Give processes a moment to exit, then force-kill leftovers
  await new Promise(resolve => setTimeout(resolve, 500));

  for (const pid of pids) {
    try {
      process.kill(pid, 0);
      process.kill(pid, 'SIGKILL');
    } catch {
      // Already gone
    }
  }
}
