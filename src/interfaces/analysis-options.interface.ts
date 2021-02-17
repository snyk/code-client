import { AnalysisSeverity } from './analysis-result.interface';

export interface AnalysisOptions {
  baseURL: string;
  sessionToken: string;
  includeLint: boolean;
  severity: AnalysisSeverity;
  sarif: boolean;
  source: string;
}

export interface AnalyzeFoldersOptions extends AnalysisOptions {
  paths: string[];
  symlinksEnabled: boolean;
  maxPayload: number;
  defaultFileIgnores: string[];
}

export interface AnalyzeGitOptions extends AnalysisOptions {
  gitUri: string;
  oAuthToken?: string;
  username?: string;
}

export interface Options {
  baseURL?: string;
  sessionToken: string;
  includeLint?: boolean;
  severity?: AnalysisSeverity;
  sarif?: boolean;
  source?: string;
}
export interface FolderOptions extends Options {
  paths: string[];
  symlinksEnabled?: boolean;
  maxPayload?: number;
  defaultFileIgnores?: string[];
}

export interface GitOptions extends Options {
  gitUri: string;
  oAuthToken?: string;
  username?: string;
}
