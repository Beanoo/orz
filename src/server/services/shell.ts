import { execFile } from "node:child_process";

export interface CommandResult {
  command: string;
  cwd: string;
  exitCode: number;
  durationMs: number;
  output: string;
}

export function runCommand(command: string, args: string[], cwd: string, timeoutMs = 120000): Promise<CommandResult> {
  const started = Date.now();
  return new Promise((resolve) => {
    execFile(command, args, { cwd, timeout: timeoutMs, maxBuffer: 1024 * 1024 * 4 }, (error, stdout, stderr) => {
      const exitCode = typeof (error as NodeJS.ErrnoException | null)?.code === "number" ? Number((error as NodeJS.ErrnoException).code) : 0;
      resolve({
        command: [command, ...args].join(" "),
        cwd,
        exitCode,
        durationMs: Date.now() - started,
        output: [stdout, stderr].filter(Boolean).join("\n").slice(-12000),
      });
    });
  });
}
