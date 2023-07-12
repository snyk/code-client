import { Log } from 'sarif';
import { AnalysisSeverity } from './analysis-options.interface';

interface Coverage {
  files: number;
  isSupported: boolean;
  lang: string;
}

interface AnalysisResultBase {
  timing: {
    fetchingCode: number;
    analysis: number;
    queue: number;
  };
  coverage: Coverage[];
  status: 'COMPLETE';
}

export interface AnalysisResultSarif extends AnalysisResultBase {
  type: 'sarif';
  sarif: Log;
}

export interface Position {
  cols: Point;
  rows: Point;
}

export interface MarkerPosition extends Position {
  file: string;
}

export type Point = [number, number];

export interface Marker {
  msg: Point;
  pos: MarkerPosition[];
}

export interface FileSuggestion extends Position {
  markers?: Marker[];
}

export interface FilePath {
  [suggestionIndex: string]: FileSuggestion[];
}

export interface AnalysisFiles {
  [filePath: string]: FilePath;
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

export interface Suggestion {
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

export interface Suggestions {
  [suggestionIndex: string]: Suggestion;
}
export interface AnalysisResultLegacy extends AnalysisResultBase {
  type: 'legacy';
  suggestions: Suggestions;
  files: AnalysisFiles;
}

export interface ReportUploadResult {
  projectId: string;
  snapshotId: string;
  reportUrl: string;
}

export interface ReportResult {
  status: 'COMPLETE';
  uploadResult: ReportUploadResult;
  analysisResult: AnalysisResultSarif;
}

export type AnalysisResult = AnalysisResultSarif | AnalysisResultLegacy;

export interface ScmAnalysis {
  analysisResults: AnalysisResultSarif;
  reportResults?: ReportUploadResult;
}
