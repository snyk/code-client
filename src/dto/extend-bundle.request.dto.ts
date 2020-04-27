import { BaseDto } from './base.dto';
import { IFiles } from '../interfaces/files.interface';

export class ExtendBundleRequestDto extends BaseDto<ExtendBundleRequestDto> {
  readonly sessionToken: string;
  readonly bundleId: string;
  readonly files: IFiles;
  readonly removedFiles?: string[];
}
