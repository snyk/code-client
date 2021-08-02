export interface File {
  hash: string;
  content: string;
}

export type BundleFiles = {
  [filePath: string]: string | File;
};

export interface FileInfo {
  filePath: string;
  bundlePath: string;
  size: number;
  hash: string;
  content?: string;
}

export type SupportedFiles = {
  configFiles: string[];
  extensions: string[];
};
