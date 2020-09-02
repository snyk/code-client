import { BaseDto } from './base.dto';

export default class ReportTelemetryRequestDto extends BaseDto<ReportTelemetryRequestDto> {
  readonly baseURL: string;
  readonly sessionToken?: string;
  readonly source?: string;
  readonly type?: string;
  readonly message?: string;
  readonly path?: string;
  readonly bundleId?: string;
  readonly version?: string;
  readonly environmentVersion?: string;
  readonly data?: any;
}
