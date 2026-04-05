import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { GIT_BINARY, ERROR_MESSAGES, DEFAULT_TIMEOUT } from "./constants.js";
import type { GitResult } from "./types.js";

const execFileAsync = promisify(execFile);

export async function execGit(
  args: string[],
  cwd: string,
  timeout: number = DEFAULT_TIMEOUT
): Promise<GitResult> {
  try {
    const result = await execFileAsync(GIT_BINARY, args, {
      cwd,
      timeout,
      maxBuffer: 10 * 1024 * 1024, // 10MB
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0", // Prevent interactive prompts
      },
    });
    return { stdout: result.stdout, stderr: result.stderr };
  } catch (error: unknown) {
    if (error instanceof Error) {
      const execError = error as NodeJS.ErrnoException & {
        stdout?: string;
        stderr?: string;
        killed?: boolean;
        code?: string | number;
      };

      if (execError.code === "ENOENT") {
        throw new Error(ERROR_MESSAGES.GIT_NOT_FOUND);
      }

      if (execError.killed) {
        throw new Error(ERROR_MESSAGES.COMMAND_TIMEOUT(timeout));
      }

      const stderr = execError.stderr ?? "";
      const stdout = execError.stdout ?? "";

      // Check for auth failures
      if (
        stderr.includes("Authentication failed") ||
        stderr.includes("Permission denied") ||
        stderr.includes("Could not read from remote repository")
      ) {
        const remoteMatch = stderr.match(/'([^']+)'/);
        throw new Error(
          ERROR_MESSAGES.AUTH_FAILURE(remoteMatch?.[1] ?? "unknown remote")
        );
      }

      // Return git's own error message
      const message = stderr.trim() || stdout.trim() || error.message;
      throw new Error(`git ${args[0]} failed: ${message}`);
    }
    throw error;
  }
}
