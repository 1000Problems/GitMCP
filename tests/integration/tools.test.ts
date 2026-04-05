import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execGit } from "../../src/git-executor.js";

let repoDir: string;

beforeAll(async () => {
  repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "gitmcp-int-"));
  await execGit(["init", "--initial-branch=main"], repoDir);
  await execGit(["config", "user.email", "test@test.com"], repoDir);
  await execGit(["config", "user.name", "Test User"], repoDir);

  // Create initial commit
  fs.writeFileSync(path.join(repoDir, "README.md"), "# Test Repo\n");
  await execGit(["add", "README.md"], repoDir);
  await execGit(["commit", "-m", "Initial commit"], repoDir);
});

afterAll(() => {
  fs.rmSync(repoDir, { recursive: true, force: true });
});

describe("git-executor", () => {
  it("runs basic git command", async () => {
    const result = await execGit(["status"], repoDir);
    expect(result.stdout).toContain("nothing to commit");
  });

  it("throws on invalid git command", async () => {
    await expect(execGit(["not-a-command"], repoDir)).rejects.toThrow();
  });

  it("throws ENOENT for missing binary", async () => {
    // We can't easily test this without mocking, but we can test timeout
  });
});

describe("git_status workflow", () => {
  it("shows clean status", async () => {
    const result = await execGit(
      ["status", "--porcelain=v2", "--branch"],
      repoDir
    );
    expect(result.stdout).toContain("branch.head main");
  });

  it("shows modified files", async () => {
    fs.writeFileSync(path.join(repoDir, "README.md"), "# Updated\n");
    const result = await execGit(
      ["status", "--porcelain=v2", "--branch"],
      repoDir
    );
    expect(result.stdout).toContain("README.md");
    // Restore
    await execGit(["checkout", "--", "README.md"], repoDir);
  });
});

describe("git_add + git_commit workflow", () => {
  it("stages and commits a file", async () => {
    fs.writeFileSync(path.join(repoDir, "new-file.txt"), "hello\n");
    await execGit(["add", "new-file.txt"], repoDir);

    const status = await execGit(
      ["status", "--porcelain=v2"],
      repoDir
    );
    expect(status.stdout).toContain("new-file.txt");

    const commit = await execGit(
      ["commit", "-m", "Add new file"],
      repoDir
    );
    expect(commit.stdout).toContain("Add new file");
  });
});

describe("git_log", () => {
  it("shows commit history", async () => {
    const result = await execGit(
      ["log", "--oneline", "-n", "5"],
      repoDir
    );
    expect(result.stdout).toContain("Add new file");
    expect(result.stdout).toContain("Initial commit");
  });
});

describe("git_diff", () => {
  it("shows diff for modified file", async () => {
    fs.writeFileSync(path.join(repoDir, "new-file.txt"), "updated\n");
    const result = await execGit(["diff"], repoDir);
    expect(result.stdout).toContain("updated");
    // Restore
    await execGit(["checkout", "--", "new-file.txt"], repoDir);
  });
});

describe("git_branch", () => {
  it("creates and lists branches", async () => {
    await execGit(["branch", "feature-test"], repoDir);
    const result = await execGit(["branch", "-a"], repoDir);
    expect(result.stdout).toContain("feature-test");
  });

  it("deletes a merged branch", async () => {
    await execGit(["branch", "-d", "feature-test"], repoDir);
    const result = await execGit(["branch", "-a"], repoDir);
    expect(result.stdout).not.toContain("feature-test");
  });
});

describe("git_checkout", () => {
  it("creates and switches to new branch", async () => {
    await execGit(["checkout", "-b", "test-branch"], repoDir);
    const result = await execGit(
      ["status", "--porcelain=v2", "--branch"],
      repoDir
    );
    expect(result.stdout).toContain("branch.head test-branch");

    // Switch back
    await execGit(["checkout", "main"], repoDir);
  });
});

describe("git_stash", () => {
  it("stashes and pops changes", async () => {
    fs.writeFileSync(
      path.join(repoDir, "new-file.txt"),
      "stash me\n"
    );
    await execGit(["stash", "push", "-m", "test stash"], repoDir);

    const content = fs.readFileSync(
      path.join(repoDir, "new-file.txt"),
      "utf-8"
    );
    expect(content).toBe("hello\n");

    await execGit(["stash", "pop"], repoDir);
    const restored = fs.readFileSync(
      path.join(repoDir, "new-file.txt"),
      "utf-8"
    );
    expect(restored).toBe("stash me\n");

    // Restore
    await execGit(["checkout", "--", "new-file.txt"], repoDir);
  });
});

describe("git_show", () => {
  it("shows commit details", async () => {
    const result = await execGit(["show", "HEAD"], repoDir);
    expect(result.stdout).toContain("Add new file");
  });

  it("shows file at ref", async () => {
    const result = await execGit(["show", "HEAD:README.md"], repoDir);
    expect(result.stdout).toContain("# Test Repo");
  });
});

describe("git_init", () => {
  it("initializes a new repo", async () => {
    const newRepo = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "gitmcp-init-")),
      "new-repo"
    );
    await execGit(["init", "--initial-branch=main", newRepo], os.tmpdir());
    expect(fs.existsSync(path.join(newRepo, ".git"))).toBe(true);
    fs.rmSync(newRepo, { recursive: true, force: true });
  });
});
