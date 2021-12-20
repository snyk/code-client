import { SupportedFiles } from '..';
import { AnalysisOptions, ConnectionOptions } from '../http';

// eslint-disable-next-line import/prefer-default-export, no-shadow
export enum AnalysisSeverity {
  info = 1,
  warning = 2,
  critical = 3,
}
export interface FileAnalysisOptions {
  connection: ConnectionOptions;
  analysisOptions: AnalysisOptions;
  fileOptions: AnalyzeFoldersOptions;
}

export interface AnalyzeFoldersOptions {
  paths: string[];
  symlinksEnabled?: boolean;
  defaultFileIgnores?: string[];
}

export interface CollectBundleFilesOptions extends AnalyzeFoldersOptions {
  supportedFiles: SupportedFiles;
  baseDir: string;
  fileIgnores: string[];
}
