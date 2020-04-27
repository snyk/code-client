import { BaseDto } from './base.dto';

export class ExtendBundleResponseDto extends BaseDto<ExtendBundleResponseDto> {
  readonly bundleId: string;
  readonly missingFiles: string[];
  readonly uploadURL: string;
}
