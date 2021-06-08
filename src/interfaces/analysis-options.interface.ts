
// eslint-disable-next-line no-shadow
export enum AnalysisSeverity {
  info = 1,
  warning = 2,
  critical = 3,
}

export interface AnalysisOptionsBase {
  baseURL: string;
  sessionToken: string;
  severity: AnalysisSeverity;
  limitToFiles?: string[];
  source: string;
  // bundleHash: string;
}

export interface AnalyzeFoldersOptions extends AnalysisOptionsBase {
  paths: string[];
  symlinksEnabled: boolean;
  maxPayload: number;
  defaultFileIgnores: string[];
}

export interface Options {
  baseURL?: string;
  sessionToken: string;
  severity?: AnalysisSeverity;
  source?: string;
}
export interface FolderOptions extends Options {
  paths: string[];
  symlinksEnabled?: boolean;
  maxPayload?: number;
  defaultFileIgnores?: string[];
}
