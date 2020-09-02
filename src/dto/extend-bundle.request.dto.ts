import { BaseDto } from './base.dto';
import { IFiles } from '../interfaces/files.interface';

export default class ExtendBundleRequestDto extends BaseDto<ExtendBundleRequestDto> {
  readonly baseURL: string;
  readonly sessionToken: string;
  readonly bundleId: string;
  readonly files: IFiles;
  readonly removedFiles?: string[];
}
