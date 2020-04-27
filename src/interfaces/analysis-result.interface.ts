import { AnalysisSeverity } from '../enums/analysis-severity.enum';

export type Point = [number, number];

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
