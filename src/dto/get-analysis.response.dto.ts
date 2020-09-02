import { IAnalysisResult } from '../interfaces/analysis-result.interface';

export enum AnalysisStatus {
  fetching = 'FETCHING',
  analyzing = 'ANALYZING',
  dcDone = 'DC_DONE',
  done = 'DONE',
  failed = 'FAILED',
}

export type GetAnalysisResponseDto = {
  readonly status: AnalysisStatus;
  readonly progress: number;
  readonly analysisURL: string;
  readonly analysisResults?: IAnalysisResult;
};
