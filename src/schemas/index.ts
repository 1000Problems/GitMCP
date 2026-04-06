import { z } from "zod";

export const GitStatusInput = z
  .object({
    repo_path: z
      .string()
      .describe("Absolute path to the git repository"),
  })
  .strict();

export const GitDiffInput = z
  .object({
    repo_path: z
      .string()
      .describe("Absolute path to the git repository"),
    staged: z
      .boolean()
      .optional()
      .default(false)
      .describe("Show staged changes (--cached)"),
    file_path: z
      .string()
      .optional()
      .describe("Limit diff to specific file"),
    ref1: z
      .string()
      .optional()
      .describe("First commit/ref for comparison"),
    ref2: z
      .string()
      .optional()
      .describe("Second commit/ref for comparison"),
  })
  .strict();

export const GitLogInput = z
  .object({
    repo_path: z
      .string()
      .describe("Absolute path to the git repository"),
    max_count: z
      .number()
      .int()
      .positive()
      .optional()
      .default(20)
      .describe("Maximum number of commits to return"),
    oneline: z
      .boolean()
      .optional()
      .default(false)
      .describe("Compact one-line format"),
    ref: z
      .string()
      .optional()
      .describe("Branch or ref to show log for"),
    file_path: z
      .string()
      .optional()
      .describe("Show history for specific file"),
    author: z
      .string()
      .optional()
      .describe("Filter by author"),
  })
  .strict();

export const GitAddInput = z
  .object({
    repo_path: z
      .string()
      .describe("Absolute path to the git repository"),
    files: z
      .array(z.string())
      .default([])
      .describe("List of file paths to stage (relative to repo root)"),
    all: z
      .boolean()
      .optional()
      .default(false)
      .describe("Stage all changes (--all)"),
  })
  .strict();

export const GitCommitInput = z
  .object({
    repo_path: z
      .string()
      .describe("Absolute path to the git repository"),
    message: z
      .string()
      .min(1)
      .describe("Commit message"),
    author: z
      .string()
      .optional()
      .describe('Override author (format: "Name <email>")'),
  })
  .strict();

export const GitPushInput = z
  .object({
    repo_path: z
      .string()
      .describe("Absolute path to the git repository"),
    remote: z
      .string()
      .optional()
      .default("origin")
      .describe("Remote name"),
    branch: z
      .string()
      .optional()
      .describe("Branch to push (defaults to current branch)"),
    set_upstream: z
      .boolean()
      .optional()
      .default(false)
      .describe("Set upstream tracking (--set-upstream)"),
  })
  .strict();

export const GitPullInput = z
  .object({
    repo_path: z
      .string()
      .describe("Absolute path to the git repository"),
    remote: z
      .string()
      .optional()
      .default("origin")
      .describe("Remote name"),
    branch: z
      .string()
      .optional()
      .describe("Branch to pull"),
    rebase: z
      .boolean()
      .optional()
      .default(false)
      .describe("Rebase instead of merge"),
  })
  .strict();

export const GitBranchInput = z
  .object({
    repo_path: z
      .string()
      .describe("Absolute path to the git repository"),
    action: z
      .enum(["list", "create", "delete"])
      .describe("Branch operation"),
    name: z
      .string()
      .optional()
      .describe("Branch name (required for create/delete)"),
    start_point: z
      .string()
      .optional()
      .describe("Starting point for new branch"),
  })
  .strict();

export const GitCheckoutInput = z
  .object({
    repo_path: z
      .string()
      .describe("Absolute path to the git repository"),
    target: z
      .string()
      .describe("Branch name, tag, or commit hash"),
    create: z
      .boolean()
      .optional()
      .default(false)
      .describe("Create new branch (-b)"),
  })
  .strict();

export const GitCloneInput = z
  .object({
    url: z
      .string()
      .describe("Repository URL (HTTPS or SSH)"),
    target_path: z
      .string()
      .describe("Absolute path for the clone destination"),
    branch: z
      .string()
      .optional()
      .describe("Specific branch to clone"),
    depth: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Shallow clone depth"),
  })
  .strict();

export const GitStashInput = z
  .object({
    repo_path: z
      .string()
      .describe("Absolute path to the git repository"),
    action: z
      .enum(["push", "pop", "list", "drop"])
      .describe("Stash operation"),
    message: z
      .string()
      .optional()
      .describe("Stash message (for push)"),
    index: z
      .number()
      .int()
      .min(0)
      .optional()
      .default(0)
      .describe("Stash index (for pop/drop)"),
  })
  .strict();

export const GitRemoteInput = z
  .object({
    repo_path: z
      .string()
      .describe("Absolute path to the git repository"),
    action: z
      .enum(["list", "add", "remove"])
      .describe("Remote operation"),
    name: z
      .string()
      .optional()
      .describe("Remote name (required for add/remove)"),
    url: z
      .string()
      .optional()
      .describe("Remote URL (required for add)"),
  })
  .strict();

export const GitInitInput = z
  .object({
    repo_path: z
      .string()
      .describe("Absolute path for the new repository"),
    initial_branch: z
      .string()
      .optional()
      .describe("Name for initial branch (defaults to server config)"),
  })
  .strict();

export const GitShowInput = z
  .object({
    repo_path: z
      .string()
      .describe("Absolute path to the git repository"),
    ref: z
      .string()
      .describe("Commit hash, tag, or ref"),
    file_path: z
      .string()
      .optional()
      .describe("Show specific file at that ref"),
  })
  .strict();

export const FsWriteInput = z
  .object({
    file_path: z
      .string()
      .describe("Absolute path to the file to write"),
    content: z
      .string()
      .describe("File content to write"),
    create_dirs: z
      .boolean()
      .optional()
      .default(true)
      .describe("Create parent directories if they don't exist"),
    encoding: z
      .enum(["utf-8", "base64"])
      .optional()
      .default("utf-8")
      .describe("Content encoding — use base64 to write binary data"),
  })
  .strict();

export const FsReadInput = z
  .object({
    file_path: z
      .string()
      .describe("Absolute path to the file to read"),
    encoding: z
      .enum(["utf-8", "base64"])
      .optional()
      .default("utf-8")
      .describe("File encoding — use base64 for binary files"),
    max_size: z
      .number()
      .int()
      .positive()
      .optional()
      .default(1048576)
      .describe("Maximum file size in bytes to read (default 1MB)"),
  })
  .strict();

export const FsListInput = z
  .object({
    path: z
      .string()
      .describe("Absolute path to the directory to list"),
    recursive: z
      .boolean()
      .optional()
      .default(false)
      .describe("List recursively"),
    max_depth: z
      .number()
      .int()
      .positive()
      .optional()
      .default(3)
      .describe("Maximum recursion depth (only with recursive)"),
    include_hidden: z
      .boolean()
      .optional()
      .default(false)
      .describe("Include dotfiles and dotdirs"),
  })
  .strict();

export const FsStatInput = z
  .object({
    path: z
      .string()
      .describe("Absolute path to check"),
  })
  .strict();

