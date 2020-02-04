import { BaseDto } from './base.dto';
import { AnalysisStatus } from '../enums/analysis-status.enum';
import { IAnalysisResult } from '../interfaces/analysis-result.interface';

export class GetAnalysisResponseDto extends BaseDto<GetAnalysisResponseDto> {
  readonly status: AnalysisStatus;
  readonly progress: number;
  readonly analysisURL: string;
  readonly analysisResults?: IAnalysisResult;
}
