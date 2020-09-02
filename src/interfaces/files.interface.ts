export interface IFiles {
  [filePath: string]: string;
}

export interface IFileContent {
  fileHash: string;
  fileContent: string;
}

export interface IFileInfo {
  path: string;
  size: number;
  hash: string;
  content?: string;
}

export interface IFileQueue {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  results: any[] | null;
  concurrency: number;
  autostart: boolean;
  on: Function;
  start: Function;
}

export interface PayloadMissingFileInterface {
  fileHash: string;
  filePath: string;
  fileContent: string;
}

export interface ISupportedFiles {
  configFiles: string[],
  extensions: string[],
}
