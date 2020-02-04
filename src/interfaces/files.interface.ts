export interface IFiles {
  [filePath: string]: string;
}

export interface IFileContent {
  fileHash: string;
  fileContent: string;
}
