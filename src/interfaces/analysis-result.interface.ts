import { ISupportedFiles } from './files.interface';
import { ISarifResult } from './sarif.interface'
export type Point = [number, number];

// eslint-disable-next-line no-shadow
export enum AnalysisSeverity {
  info = 1,
  warning = 2,
  critical = 3,
}

export interface ISuggestion {
  id: string;
  message: string;
  severity: AnalysisSeverity;
  leadURL?: string;
  rule: string;
  tags: string[];
}

export interface ISuggestions {
  [suggestionIndex: number]: ISuggestion;
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
  [suggestionIndex: number]: IFileSuggestion[];
}

export interface IAnalysisFiles {
  [filePath: string]: IFilePath;
}

export interface IAnalysisResult {
  suggestions: ISuggestions;
  files: IAnalysisFiles;
}

export interface IBundleArgs {
  readonly baseURL: string;
  readonly sessionToken: string;
  readonly includeLint: boolean;
  readonly severity: AnalysisSeverity;
}

export interface IBundleResult {
  readonly bundleId: string;
  readonly analysisResults?: IAnalysisResult;
  readonly sarifResults?: ISarifResult;
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
