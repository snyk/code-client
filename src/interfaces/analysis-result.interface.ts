// eslint-disable-next-line import/no-unresolved
import { Log } from 'sarif';

import { ISupportedFiles } from './files.interface';

export type Point = [number, number];

// eslint-disable-next-line no-shadow
export enum AnalysisSeverity {
  info = 1,
  warning = 2,
  critical = 3,
}

interface CommitChangeLine {
  line: string;
  lineNumber: number;
  lineChange: 'removed' | 'added' | 'none';
}

interface ExampleCommitFix {
  commitURL: string;
  lines: CommitChangeLine[];
}

export interface ISuggestion {
  id: string;
  message: string;
  severity: AnalysisSeverity;
  leadURL?: string;
  rule: string;
  tags: string[];
  categories: string[];
  repoDatasetSize: number;
  exampleCommitDescriptions: string[];
  exampleCommitFixes: ExampleCommitFix[];
  cwe: string[];
  title: string;
  text: string;
}

export interface ISuggestions {
  [suggestionIndex: string]: ISuggestion;
}

export interface IPosition {
  cols: Point;
  rows: Point;
}

export interface IMarker {
  msg: Point;
  pos: IPosition[];
}

export interface IFileSuggestion extends IPosition {
  markers?: IMarker[];
}

export interface IFilePath {
  [suggestionIndex: string]: IFileSuggestion[];
}

export interface IAnalysisFiles {
  [filePath: string]: IFilePath;
}

interface ICoverage {
  files: number;
  isSupported: boolean;
  lang: string;
}

export interface IAnalysisResult {
  suggestions: ISuggestions;
  files: IAnalysisFiles;
  timing: {
    analysis: number;
    fetchingCode: number;
    queue: number;
  };
  coverage: ICoverage[];
}

export interface IBundleArgs {
  readonly baseURL: string;
  readonly sessionToken: string;
  readonly oAuthToken?: string;
  readonly includeLint: boolean;
  readonly severity: AnalysisSeverity;
}

export interface IBundleResult {
  readonly bundleId: string;
  readonly analysisResults: IAnalysisResult;
  readonly sarifResults?: Log;
  readonly analysisURL: string;
}

interface IBundleBase extends IBundleArgs, IBundleResult {}

export interface IGitBundle extends IBundleBase {
  readonly gitUri: string;
}

export interface IFileBundle extends IBundleBase {
  readonly baseDir: string;
  readonly paths: string[];
  readonly supportedFiles: ISupportedFiles;
  readonly fileIgnores: string[];
  readonly symlinksEnabled: boolean;
}
