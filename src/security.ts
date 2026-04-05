import * as fs from "node:fs";
import * as path from "node:path";
import { ERROR_MESSAGES } from "./constants.js";

export function isPathAllowed(
  requestedPath: string,
  allowedPaths: string[]
): boolean {
  if (requestedPath.includes("\0")) {
    return false;
  }

  let resolved: string;
  try {
    resolved = fs.realpathSync(path.resolve(requestedPath));
  } catch {
    // If the path doesn't exist yet (e.g., clone target), resolve without realpathSync
    // but still check the parent directory
    resolved = path.resolve(requestedPath);
    const parent = path.dirname(resolved);
    try {
      resolved = path.join(fs.realpathSync(parent), path.basename(resolved));
    } catch {
      return false;
    }
  }

  return allowedPaths.some((allowed) => {
    let resolvedAllowed: string;
    try {
      resolvedAllowed = fs.realpathSync(path.resolve(allowed));
    } catch {
      resolvedAllowed = path.resolve(allowed);
    }
    return (
      resolved === resolvedAllowed ||
      resolved.startsWith(resolvedAllowed + path.sep)
    );
  });
}

export function validateRepoPath(
  requestedPath: string,
  allowedPaths: string[]
): void {
  if (requestedPath.includes("\0")) {
    throw new Error(ERROR_MESSAGES.NULL_BYTE);
  }

  if (!isPathAllowed(requestedPath, allowedPaths)) {
    throw new Error(
      ERROR_MESSAGES.PATH_OUTSIDE_ALLOWED(requestedPath, allowedPaths)
    );
  }
}
