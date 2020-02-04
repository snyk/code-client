import { BaseDto } from './base.dto';

export interface Files {
  [filePath: string]: string;
}

export class CreateBundleRequestDto extends BaseDto<CreateBundleRequestDto> {
  readonly sessionToken: string;
  readonly files: Files;
}
