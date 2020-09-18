import { ISupportedFiles } from './files.interface';

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
  pos: IPosition;
}

export interface IFileSuggestion {
  cols: Point;
  rows: Point;
  markers: IMarker[];
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


interface IBundleBase {
  readonly baseURL: string;
  readonly sessionToken: string;
  readonly includeLint: boolean;
  readonly severity: AnalysisSeverity;
  readonly bundleId: string;
  readonly analysisResults: IAnalysisResult;
  readonly analysisURL: string;
}

export interface IGitBundle extends IBundleBase {
  readonly gitUri: string;
}

export interface IFileBundle extends IBundleBase {
  readonly paths: string[];
  readonly supportedFiles: ISupportedFiles;
}
