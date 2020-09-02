import { BaseDto } from './base.dto';

export default class CheckBundleRequestDto extends BaseDto<CheckBundleRequestDto> {
  readonly baseURL: string;
  readonly sessionToken: string;
  readonly bundleId: string;
}
