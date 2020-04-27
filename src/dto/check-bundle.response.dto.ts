import { BaseDto } from './base.dto';

export class CheckBundleResponseDto extends BaseDto<CheckBundleResponseDto> {
  readonly bundleId: string;
  readonly missingFiles?: string[];
  readonly uploadURL?: string;
}
