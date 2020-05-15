import { IAnalysisResult } from './analysis-result.interface';

export interface IQueueDebugInfo {
  requestBody: string;
  chunkSize: number;
  chunkNumber: number;
  filesCount: number;
  files: string[];
  errorText: string;
  error: string;
}

export interface IQueueAnalysisCheck {
  baseURL: string;
  sessionToken: string;
  bundleId: string;
  useLinter?: boolean;
}

export interface IQueueAnalysisCheckResult {
  analysisResults: IAnalysisResult;
  analysisURL: string;
}
