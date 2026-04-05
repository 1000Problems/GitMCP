import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { isPathAllowed, validateRepoPath } from "../../src/security.js";

describe("isPathAllowed", () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gitmcp-sec-"));
    fs.mkdirSync(path.join(tmpDir, "allowed", "sub"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, "forbidden"), { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("allows exact match", () => {
    const allowed = [path.join(tmpDir, "allowed")];
    expect(isPathAllowed(path.join(tmpDir, "allowed"), allowed)).toBe(true);
  });

  it("allows subdirectory", () => {
    const allowed = [path.join(tmpDir, "allowed")];
    expect(isPathAllowed(path.join(tmpDir, "allowed", "sub"), allowed)).toBe(
      true
    );
  });

  it("rejects path outside allowed", () => {
    const allowed = [path.join(tmpDir, "allowed")];
    expect(isPathAllowed(path.join(tmpDir, "forbidden"), allowed)).toBe(false);
  });

  it("rejects path traversal with ..", () => {
    const allowed = [path.join(tmpDir, "allowed")];
    expect(
      isPathAllowed(path.join(tmpDir, "allowed", "..", "forbidden"), allowed)
    ).toBe(false);
  });

  it("rejects null bytes", () => {
    const allowed = [path.join(tmpDir, "allowed")];
    expect(isPathAllowed(tmpDir + "/allowed\0/evil", allowed)).toBe(false);
  });

  it("supports multiple allowed paths", () => {
    const allowed = [
      path.join(tmpDir, "allowed"),
      path.join(tmpDir, "forbidden"),
    ];
    expect(isPathAllowed(path.join(tmpDir, "forbidden"), allowed)).toBe(true);
  });

  it("rejects non-existent paths outside allowed", () => {
    const allowed = [path.join(tmpDir, "allowed")];
    expect(isPathAllowed("/nonexistent/path/somewhere", allowed)).toBe(false);
  });

  it("handles symlink traversal", () => {
    const symlinkPath = path.join(tmpDir, "allowed", "sneaky-link");
    try {
      fs.symlinkSync(path.join(tmpDir, "forbidden"), symlinkPath);
      const allowed = [path.join(tmpDir, "allowed")];
      // The symlink resolves to forbidden dir, which is outside allowed
      expect(isPathAllowed(symlinkPath, allowed)).toBe(false);
    } finally {
      try {
        fs.unlinkSync(symlinkPath);
      } catch {
        // ignore cleanup errors
      }
    }
  });
});

describe("validateRepoPath", () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gitmcp-val-"));
    fs.mkdirSync(path.join(tmpDir, "allowed"), { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("does not throw for valid paths", () => {
    const allowed = [path.join(tmpDir, "allowed")];
    expect(() =>
      validateRepoPath(path.join(tmpDir, "allowed"), allowed)
    ).not.toThrow();
  });

  it("throws for null bytes", () => {
    const allowed = [path.join(tmpDir, "allowed")];
    expect(() => validateRepoPath("/path\0evil", allowed)).toThrow(
      "null bytes"
    );
  });

  it("throws for paths outside allowed", () => {
    const allowed = [path.join(tmpDir, "allowed")];
    expect(() => validateRepoPath("/etc/passwd", allowed)).toThrow(
      "outside allowed"
    );
  });
});
