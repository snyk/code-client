import { BaseDto } from './base.dto';

export class GetAnalysisRequestDto extends BaseDto<GetAnalysisRequestDto> {
  readonly baseURL: string;
  readonly sessionToken: string;
  readonly bundleId: string;
  readonly useLinters?: boolean;
}
