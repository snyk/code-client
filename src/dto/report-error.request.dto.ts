import { BaseDto } from './base.dto';

export class ReportErrorRequestDto extends BaseDto<ReportErrorRequestDto> {
  readonly baseURL: string;
  readonly sessionToken?: string;
  readonly source?: string;
  readonly type?: string;
  readonly message?: string;
  readonly path?: string;
  readonly bundleId?: string;
  readonly data?: any;
}
