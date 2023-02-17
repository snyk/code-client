import { AnalysisResult } from '..';
import { FileBundle } from '../bundles';
import { FileAnalysisOptions } from './analysis-options.interface';
import { ReportUploadResult } from './analysis-result.interface';

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

export interface FileAnalysis extends FileAnalysisOptions {
  fileBundle: FileBundle;
  analysisResults: AnalysisResult;
  reportResults?: ReportUploadResult;
}
