import { BaseDto } from './base.dto';

export class UploadFilesResponseDto extends BaseDto<UploadFilesResponseDto> {
  readonly success: boolean;
}
