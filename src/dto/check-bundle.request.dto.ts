import { BaseDto } from './base.dto';

export class CheckBundleRequestDto extends BaseDto<CheckBundleRequestDto> {
  readonly baseURL: string;
  readonly sessionToken: string;
  readonly bundleId: string;
}
