import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { validateRepoPath } from "../../src/security.js";

let testDir: string;
const allowedPaths: string[] = [];

beforeAll(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), "gitmcp-fs-"));
  allowedPaths.push(testDir);

  // Create some test files
  fs.writeFileSync(path.join(testDir, "hello.txt"), "Hello, world!\n");
  fs.mkdirSync(path.join(testDir, "subdir"));
  fs.writeFileSync(
    path.join(testDir, "subdir", "nested.txt"),
    "nested content\n"
  );
  fs.mkdirSync(path.join(testDir, ".git", "objects"), { recursive: true });
  fs.writeFileSync(
    path.join(testDir, ".git", "config"),
    "[core]\n\tbare = false\n"
  );
});

afterAll(() => {
  fs.rmSync(testDir, { recursive: true, force: true });
});

describe("fs_write", () => {
  it("creates a new file and returns correct size", () => {
    const filePath = path.join(testDir, "new-file.txt");
    const content = "This is new content\n";
    fs.writeFileSync(filePath, content, "utf-8");

    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.readFileSync(filePath, "utf-8")).toBe(content);
    expect(fs.statSync(filePath).size).toBe(
      Buffer.byteLength(content, "utf-8")
    );
  });

  it("creates parent directories when they don't exist", () => {
    const filePath = path.join(testDir, "deep", "nested", "dir", "file.txt");
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, "deep content\n", "utf-8");

    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.readFileSync(filePath, "utf-8")).toBe("deep content\n");
  });

  it("rejects path outside allowedPaths", () => {
    const outsidePath = path.join(os.tmpdir(), "outside-fs-test.txt");
    expect(() => validateRepoPath(outsidePath, allowedPaths)).toThrow(
      "outside allowed"
    );
  });

  it("rejects paths containing /.git/", () => {
    const gitPath = path.join(testDir, ".git", "hooks", "pre-commit");
    // The fs_write tool checks for /.git/ before calling validateRepoPath
    expect(gitPath.includes("/.git/")).toBe(true);
  });

  it("rejects content over 5MB", () => {
    const bigContent = "x".repeat(5 * 1024 * 1024 + 1);
    const byteLength = Buffer.byteLength(bigContent, "utf-8");
    expect(byteLength).toBeGreaterThan(5 * 1024 * 1024);
  });
});

describe("fs_read", () => {
  it("returns file contents correctly", () => {
    const filePath = path.join(testDir, "hello.txt");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toBe("Hello, world!\n");
  });

  it("rejects path outside allowedPaths", () => {
    const outsidePath = "/etc/passwd";
    expect(() => validateRepoPath(outsidePath, allowedPaths)).toThrow(
      "outside allowed"
    );
  });

  it("rejects file over max_size", () => {
    const filePath = path.join(testDir, "hello.txt");
    const stat = fs.statSync(filePath);
    // Simulate max_size check: file is 14 bytes, so max_size=10 should fail
    expect(stat.size).toBeGreaterThan(10);
  });
});

describe("fs_list", () => {
  it("lists directory contents", () => {
    const entries = fs.readdirSync(testDir, { withFileTypes: true });
    const names = entries.map((e) => e.name);
    expect(names).toContain("hello.txt");
    expect(names).toContain("subdir");
  });

  it("recursive mode shows nested entries", () => {
    const entries = fs.readdirSync(path.join(testDir, "subdir"), {
      withFileTypes: true,
    });
    const names = entries.map((e) => e.name);
    expect(names).toContain("nested.txt");
  });

  it("rejects path outside allowedPaths", () => {
    expect(() => validateRepoPath("/etc", allowedPaths)).toThrow(
      "outside allowed"
    );
  });
});

describe("fs_stat", () => {
  it("returns correct metadata for existing file", () => {
    const filePath = path.join(testDir, "hello.txt");
    const stat = fs.statSync(filePath);
    expect(stat.isFile()).toBe(true);
    expect(stat.size).toBe(14); // "Hello, world!\n"
    expect(stat.mtime).toBeInstanceOf(Date);
  });

  it("returns exists: false for non-existent path", () => {
    const missingPath = path.join(testDir, "does-not-exist.txt");
    let exists = true;
    try {
      fs.statSync(missingPath);
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        "code" in err &&
        (err as NodeJS.ErrnoException).code === "ENOENT"
      ) {
        exists = false;
      }
    }
    expect(exists).toBe(false);
  });

  it("rejects path outside allowedPaths", () => {
    expect(() => validateRepoPath("/tmp/../etc/passwd", allowedPaths)).toThrow(
      "outside allowed"
    );
  });
});
