import { BaseDto } from './base.dto';
import { IFileContent } from '../interfaces/files.interface';

export class UploadFilesRequestDto extends BaseDto<UploadFilesRequestDto> {
  readonly baseURL: string;
  readonly sessionToken: string;
  readonly bundleId: string;
  readonly content: IFileContent[];
}
