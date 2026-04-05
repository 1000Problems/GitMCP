export interface ServerConfig {
  allowedPaths: string[];
  defaultBranch: string;
  timeout: number;
}

export interface GitResult {
  stdout: string;
  stderr: string;
}

export interface StatusEntry {
  path: string;
  indexStatus: string;
  workTreeStatus: string;
  origPath?: string;
}

export interface BranchInfo {
  name: string;
  current: boolean;
  remote: boolean;
  upstream?: string;
}

export interface LogEntry {
  hash: string;
  author: string;
  date: string;
  message: string;
}

export interface RemoteInfo {
  name: string;
  fetchUrl: string;
  pushUrl: string;
}
