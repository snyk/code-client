// import { BaseDto } from './base.dto';
// export default class CheckBundleResponseDto extends BaseDto<CheckBundleResponseDto> {

type CheckBundleResponseDto = {
  readonly bundleId: string;
  readonly missingFiles?: string[];
  readonly uploadURL?: string;
};

export default CheckBundleResponseDto;
