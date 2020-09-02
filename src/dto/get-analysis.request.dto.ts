import { BaseDto } from './base.dto';

export default class GetAnalysisRequestDto extends BaseDto<GetAnalysisRequestDto> {
  readonly baseURL: string;
  readonly sessionToken: string;
  readonly bundleId: string;
  readonly useLinters?: boolean;
}
