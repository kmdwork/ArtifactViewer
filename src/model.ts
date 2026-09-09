export type GitMetadata = {
  repository?: string;
  branch?: string;
  commit?: string;
  baseCommit?: string;
};

export type Artifact = {
  path: string;
  fileName: string;
  title: string;
  type: string;
  project: string;
  createdAt: string;
  tags: string[];
  risk?: string;
  git?: GitMetadata;
  html: string;
  warnings: string[];
};

export type ScanResult = {
  artifacts: Artifact[];
  failedFiles: number;
  directoryMissing: boolean;
};

export type Filters = {
  query: string;
  type: string;
  project: string;
};
