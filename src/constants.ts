export const DEFAULT_BRANCH = "main";
export const DEFAULT_TIMEOUT = 30_000;
export const DEFAULT_LOG_MAX_COUNT = 20;

export const GIT_BINARY = "git";

export const ERROR_MESSAGES = {
  PATH_OUTSIDE_ALLOWED: (requested: string, allowed: string[]) =>
    `Path '${requested}' is outside allowed directories. Allowed: ${allowed.join(", ")}`,
  NOT_A_REPO: (path: string) =>
    `'${path}' is not a git repository. Run git_init first or check the path.`,
  NOTHING_STAGED: "Nothing to commit. Stage files with git_add first.",
  GIT_NOT_FOUND: "git executable not found. Ensure git is installed and in PATH.",
  COMMAND_TIMEOUT: (timeout: number) =>
    `Git command timed out after ${timeout}ms. The operation may still be running.`,
  AUTH_FAILURE: (remote: string) =>
    `Authentication failed for '${remote}'. Check SSH keys or credentials.`,
  NULL_BYTE: "Path contains null bytes, which is not allowed.",
} as const;
