import { BaseDto } from './base.dto';

export class CreateBundleResponseDto extends BaseDto<CreateBundleResponseDto> {
  readonly bundleId: string;
  readonly missingFiles: string[];
  readonly uploadURL: string;
}
